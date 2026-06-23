# UE Scene Proxy Semantic Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first production-shaped UE scene import path: scene-level manifest v2, scene-origin rebasing, 5 km viewport adaptation, semantic metadata, and semantic ID-color rendering.

**Architecture:** Keep the existing browser controller as the compatibility layer, but make it accept both legacy `rocks.instances.json` and new `scene.manifest.json`. UE remains the authoritative exporter for actor/component grouping, world transforms, metadata, stable proxy mesh filenames, and initial semantic fields. Three.js converts UE coordinates once, loads reusable proxy GLBs through the existing mesh cache, stores metadata on actor/component groups, and switches materials between shared gray and cached semantic color materials without reloading geometry.

**Tech Stack:** Browser-native ES modules, Three.js 0.165 import map, Unreal Python Editor API, static Node-style tests run through the Codex Node REPL because `node` is not on this Windows PATH, and in-app browser verification at `http://localhost:5173/?right-handle-test=1`.

## Global Constraints

- Keep current legacy rock sync path working while adding `scene.manifest.json`.
- Do not move browser simplification into a new dependency in this pass.
- Keep UE coordinates exported in centimeters and browser scene units in meters.
- Rebase all v2 actor/component locations by `sceneOrigin` before converting to Three.js coordinates.
- Use actor groups as the default selection target for imported UE content.
- Cache semantic materials by display mode and semantic color; do not create one material per mesh.
- Keep current dirty workspace changes intact; never revert unrelated files.

---

## File Structure

- Modify `public/src/ue-rock-sync.js`: normalize v2 scene manifests, normalize semantic rules, apply `sceneOrigin`, classify semantics, cache gray/semantic materials, expose display mode switching, and keep legacy manifest compatibility.
- Modify `public/src/editor.js`: point UE sync to the new scene manifest with legacy fallback, expose a compact semantic mode button, adapt camera far and grid scale from manifest `gridSizeMeters`, and update outliner/type labels for imported scene actors.
- Modify `public/index.html`: update UE panel labels/source text and add one flat semantic color toggle button.
- Modify `tools/unreal/sync_selected_static_mesh_rocks.py`: write `scene.manifest.json` and `semantic.rules.json` in addition to the legacy file, add scene-origin computation, actor/component metadata, material-slot names, tags, folder/class values, semantic classification, and stable proxy mesh filenames.
- Modify `tests/ue-rock-sync.test.mjs`: add behavior tests for v2 manifest normalization, scene-origin transform rebasing, semantic rules, semantic material switching, and fallback-to-legacy loading.
- Modify `tests/unreal-export-script.test.mjs`: add static tests for the new UE exporter manifest/rules paths and v2 metadata functions.
- Modify `tests/editor-architecture.test.mjs`: add static tests for the UI wiring and viewer adaptation hooks.

## Task 1: Add Failing Browser Import Tests

**Files:**
- Modify: `tests/ue-rock-sync.test.mjs`
- Test: `tests/ue-rock-sync.test.mjs`

**Interfaces:**
- Consumes: existing exports from `public/src/ue-rock-sync.js`.
- Produces expected exports: `normalizeSceneSyncManifest(input)`, `normalizeSemanticRules(input)`, and existing `createUnrealRockSyncController(...)` support for `semanticRulesUrl`, `fallbackManifestUrl`, `setDisplayMode(mode)`, and `getDisplayMode()`.

- [ ] **Step 1: Add v2 manifest import assertions**

Append this test block before the controller integration test:

```js
import {
  normalizeSceneSyncManifest,
  normalizeSemanticRules
} from "../public/src/ue-rock-sync.js";

const sceneManifest = normalizeSceneSyncManifest({
  schema: "composition-pipeline.ue-scene.v2",
  assetsBaseUrl: "/ue-sync/meshes/",
  sceneOrigin: [1000, 2000, 0],
  gridSizeMeters: 5000,
  actors: [
    {
      id: "BP_Ruin_001",
      label: "Ruin Wall",
      class: "BP_RuinWall",
      folderPath: "Ruins/Wall",
      tags: ["ruin"],
      semantic: "wall",
      colorId: 12,
      transform: {
        location: [1100, 1800, 50],
        quaternion: [0, 0, 0.7071068, 0.7071068],
        scale: [1, 1, 1]
      },
      components: [
        {
          id: "BP_Ruin_001_SM_1",
          name: "StaticMeshComponent0",
          type: "StaticMeshComponent",
          mesh: "SM_Ruin_proxy.glb",
          meshAssetPath: "/Game/Ruins/Wall/SM_Ruin",
          materialSlots: ["M_Stone"],
          tags: [],
          transform: {
            location: [1125, 1850, 50],
            quaternion: [0, 0, 0.7071068, 0.7071068],
            scale: [100, 100, 100]
          }
        }
      ]
    }
  ]
});

assert.equal(sceneManifest.schema, "composition-pipeline.ue-scene.v2");
assert.deepEqual(sceneManifest.sceneOrigin, [1000, 2000, 0]);
assert.equal(sceneManifest.gridSizeMeters, 5000);
assert.equal(sceneManifest.instances.length, 1);
assert.equal(sceneManifest.instances[0].id, "BP_Ruin_001");
assert.equal(sceneManifest.instances[0].children.length, 1);
assert.equal(sceneManifest.instances[0].children[0].mesh, "SM_Ruin_proxy.glb");
assert.equal(sceneManifest.instances[0].semantic, "wall");
assert.equal(sceneManifest.instances[0].children[0].semantic, "wall");

const rebasedActorTransform = createSceneTransformFromUnrealInstance(sceneManifest.instances[0], {
  sceneOrigin: sceneManifest.sceneOrigin,
  scaleMode: "unitless"
});
assert.deepEqual(rebasedActorTransform.position, { x: 1, y: 2, z: 0.5 });
```

- [ ] **Step 2: Add semantic rules assertions**

Append:

```js
const semanticRules = normalizeSemanticRules({
  classes: {
    wall: { id: 12, color: "#d14b4b" },
    unclassified: { id: 0, color: "#ff00ff" }
  },
  rules: [
    { if: { assetPathContains: "/Wall/" }, semantic: "wall" }
  ]
});

assert.equal(semanticRules.classes.wall.id, 12);
assert.equal(semanticRules.classes.wall.color, "#d14b4b");
assert.equal(semanticRules.rules[0].semantic, "wall");
```

- [ ] **Step 3: Extend fake controller test for semantic display mode**

In the controller construction, add `semanticRulesUrl: "/ue-sync/semantic.rules.json"` and make `fetchJson` return rules for URLs ending in `semantic.rules.json`; otherwise return a v2 scene manifest. After `await controller.sync();`, add:

```js
assert.equal(controller.getDisplayMode(), "gray");
controller.setDisplayMode("semanticColor");
assert.equal(controller.getDisplayMode(), "semanticColor");
assert.equal(syncedChildMesh.material.options.color, "#d14b4b");
controller.setDisplayMode("gray");
assert.equal(syncedChildMesh.material.options.color, 0x9b9b9b);
```

- [ ] **Step 4: Add legacy fallback assertion**

Create a second controller whose `fetchJson` throws on `"/ue-sync/scene.manifest.json"` and returns the existing legacy shape for `"/ue-sync/rocks.instances.json"`. Assert `await fallbackController.sync()` returns a manifest with one instance and that `fallbackController.group.children.length === 1`.

- [ ] **Step 5: Run the test and verify RED**

Run through Codex Node REPL:

```js
await import(`file:///D:/CompositionPipeline/tests/ue-rock-sync.test.mjs?red=${Date.now()}`);
```

Expected: import fails because `normalizeSceneSyncManifest`, `normalizeSemanticRules`, or semantic display methods do not exist yet.

## Task 2: Implement Scene Manifest And Semantic Runtime

**Files:**
- Modify: `public/src/ue-rock-sync.js`
- Test: `tests/ue-rock-sync.test.mjs`

**Interfaces:**
- Produces `normalizeSceneSyncManifest(input = {}) -> normalized manifest with instances`.
- Produces `normalizeSemanticRules(input = {}) -> { classes, rules }`.
- Extends `createUnrealRockSyncController(...)` with `fallbackManifestUrl`, `semanticRulesUrl`, `setDisplayMode`, and `getDisplayMode`.

- [ ] **Step 1: Add v2 constants**

Add near the top:

```js
const defaultSceneManifestUrl = "/ue-sync/scene.manifest.json";
const defaultLegacyManifestUrl = "/ue-sync/rocks.instances.json";
const defaultSemanticRulesUrl = "/ue-sync/semantic.rules.json";
const unclassifiedSemantic = "unclassified";
const defaultSemanticClasses = {
  unclassified: { id: 0, color: "#ff00ff" }
};
```

- [ ] **Step 2: Add transform normalization helper**

Add:

```js
function normalizeTransformRecord(transform = {}) {
  return {
    location: normalizeVector(transform.location, [0, 0, 0]),
    rotation: normalizeVector(transform.rotation, [0, 0, 0]),
    quaternion: normalizeQuaternion(transform.quaternion),
    scale: normalizeVector(transform.scale, [1, 1, 1]),
    sceneMatrix: normalizeMatrix(transform.sceneMatrix)
  };
}
```

- [ ] **Step 3: Add v2 component and actor normalization**

Add functions that map actors/components into the existing `instances` shape:

```js
function normalizeSceneComponent(input, index, actor) {
  if (!input?.mesh) {
    throw new Error(`UE scene component ${index + 1} is missing mesh`);
  }

  const transform = normalizeTransformRecord(input.transform || input);

  return {
    id: input.id || `${actor.id}-component-${index + 1}`,
    label: input.label || input.name || `Component ${index + 1}`,
    type: input.type || "StaticMeshComponent",
    mesh: input.mesh,
    meshAssetPath: input.meshAssetPath || null,
    materialSlots: Array.isArray(input.materialSlots) ? input.materialSlots : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    semantic: input.semantic || actor.semantic || unclassifiedSemantic,
    colorId: Number.isFinite(Number(input.colorId)) ? Number(input.colorId) : actor.colorId,
    sourceMetadata: input.sourceMetadata || {},
    ...transform
  };
}

function normalizeSceneActor(input, index) {
  const actorId = input?.id || `ue-scene-actor-${index + 1}`;
  const transform = normalizeTransformRecord(input?.transform || input);
  const actor = {
    id: actorId,
    label: input?.label || actorId,
    class: input?.class || input?.className || "",
    folderPath: input?.folderPath || "",
    tags: Array.isArray(input?.tags) ? input.tags : [],
    semantic: input?.semantic || unclassifiedSemantic,
    colorId: Number.isFinite(Number(input?.colorId)) ? Number(input.colorId) : null,
    mesh: null,
    meshAssetPath: null,
    children: [],
    source: "unreal-scene-actor",
    sourceMetadata: input?.sourceMetadata || {},
    ...transform
  };

  const components = Array.isArray(input?.components) ? input.components : [];
  actor.children = components.map((component, componentIndex) => normalizeSceneComponent(component, componentIndex, actor));
  return actor;
}
```

- [ ] **Step 4: Add `normalizeSceneSyncManifest`**

Add:

```js
export function normalizeSceneSyncManifest(input = {}) {
  if (Array.isArray(input.instances) && !Array.isArray(input.actors)) {
    return {
      ...normalizeRockSyncManifest(input),
      schema: input.schema || "composition-pipeline.ue-rock-sync.v1",
      sceneOrigin: normalizeVector(input.sceneOrigin, [0, 0, 0]),
      gridSizeMeters: Number(input.gridSizeMeters) || null
    };
  }

  const actors = Array.isArray(input.actors) ? input.actors : [];

  return {
    schema: input.schema || "composition-pipeline.ue-scene.v2",
    assetsBaseUrl: input.assetsBaseUrl || defaultAssetsBaseUrl,
    sceneOrigin: normalizeVector(input.sceneOrigin, [0, 0, 0]),
    gridSizeMeters: Number(input.gridSizeMeters) || null,
    semanticRulesUrl: input.semanticRulesUrl || defaultSemanticRulesUrl,
    instances: actors.map(normalizeSceneActor)
  };
}
```

- [ ] **Step 5: Add semantic rule normalization and matching**

Add `normalizeSemanticRules`, `semanticMatchesRule`, and `semanticForInstance` helpers that match lowercase text against `assetPathContains`, `blueprintClassContains`, `actorLabelContains`, `componentNameContains`, `materialContains`, `folderPathContains`, and `tagContains`. Return existing semantic first, then matching rule, then `unclassified`.

- [ ] **Step 6: Add material cache and display mode switching**

Change gray material creation from per-object to controller-level material caches:

```js
const grayMaterial = new THREE.MeshStandardMaterial({ color: 0x9b9b9b, roughness: 0.92, metalness: 0.02 });
const semanticMaterials = new Map();
let displayMode = "gray";
let semanticRules = normalizeSemanticRules();
```

Add `materialForMesh(meshMetadata)` and `applyDisplayMode()` inside the controller. In gray mode, assign `grayMaterial`; in semanticColor mode, assign a cached material using the semantic class color or `#ff00ff`.

- [ ] **Step 7: Load manifest with fallback**

Inside `sync()`, fetch `manifestUrl`; if it throws and `fallbackManifestUrl` exists, fetch fallback. Normalize with `normalizeSceneSyncManifest(rawManifest)`. Then fetch semantic rules from `semanticRulesUrl`; if it fails, use defaults.

- [ ] **Step 8: Apply scene origin during transforms**

Extend `createSceneTransformFromUnrealInstance(instance, { sceneOrigin = [0, 0, 0], scaleMode = "mesh" } = {})` so it subtracts `sceneOrigin` from the normalized location before converting centimeters to meters.

- [ ] **Step 9: Attach metadata to actor and component groups**

Set actor group `userData.assetType = "ue-scene-actor"` for v2 manifests and keep `"ue-rock"` for legacy manifests. Copy `semantic`, `colorId`, `label`, `class`, `folderPath`, `tags`, and `sourceMetadata` into `userData`.

- [ ] **Step 10: Run GREEN verification**

Run:

```js
await import(`file:///D:/CompositionPipeline/tests/ue-rock-sync.test.mjs?green=${Date.now()}`);
```

Expected: test completes without throwing.

## Task 3: Add Failing Editor And UE Exporter Tests

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Modify: `tests/unreal-export-script.test.mjs`
- Test: both files

**Interfaces:**
- Editor consumes controller display mode and manifest metadata.
- UE script produces `scene.manifest.json`, `semantic.rules.json`, `sceneOrigin`, `actors`, and legacy compatibility output.

- [ ] **Step 1: Add editor architecture assertions**

In `tests/editor-architecture.test.mjs`, add assertions that `public/index.html` contains `id="ue-semantic-mode-button"`, `/ue-sync/scene.manifest.json`, and `/ue-sync/semantic.rules.json`; add assertions that `public/src/editor.js` contains `fallbackManifestUrl`, `semanticRulesUrl`, `setImportedSceneDisplayMode`, `adaptImportedSceneToManifest`, and `gridMaterial.uniforms.fadeDistance.value`.

- [ ] **Step 2: Add UE exporter static assertions**

In `tests/unreal-export-script.test.mjs`, add assertions for:

```js
assert.match(script, /SCENE_MANIFEST_PATH\s*=\s*OUTPUT_ROOT\s*\/\s*["']scene\.manifest\.json["']/);
assert.match(script, /SEMANTIC_RULES_PATH\s*=\s*OUTPUT_ROOT\s*\/\s*["']semantic\.rules\.json["']/);
assert.match(script, /def selected_scene_origin\(actors\)/);
assert.match(script, /def semantic_for_metadata\(/);
assert.match(script, /"schema":\s*["']composition-pipeline\.ue-scene\.v2["']/);
assert.match(script, /"sceneOrigin"/);
assert.match(script, /"gridSizeMeters"/);
assert.match(script, /"actors"/);
assert.match(script, /"components"/);
assert.match(script, /"materialSlots"/);
assert.match(script, /"semanticRulesUrl":\s*["']\/ue-sync\/semantic\.rules\.json["']/);
assert.match(script, /json\.dump\(scene_manifest,/);
assert.match(script, /json\.dump\(semantic_rules,/);
```

- [ ] **Step 3: Run RED verification**

Run both test modules through Codex Node REPL:

```js
await import(`file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs?red=${Date.now()}`);
await import(`file:///D:/CompositionPipeline/tests/unreal-export-script.test.mjs?red=${Date.now()}`);
```

Expected: at least one assertion fails for missing editor/UE exporter v2 wiring.

## Task 4: Wire Editor UI And 5 km Viewer Adaptation

**Files:**
- Modify: `public/index.html`
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

**Interfaces:**
- Consumes `ueRockSync.setDisplayMode(mode)`, `ueRockSync.getDisplayMode()`, and manifest `gridSizeMeters`.
- Produces `setImportedSceneDisplayMode(mode)` and `adaptImportedSceneToManifest(manifest)`.

- [ ] **Step 1: Update UE panel labels and source text**

Change button text to `Sync Selected UE Scene Proxies`, source text to `/ue-sync/scene.manifest.json`, and add:

```html
<button id="ue-semantic-mode-button" class="ue-rock-sync-button" type="button" data-ue-semantic-mode>
  ID Color Mode
</button>
<div id="ue-semantic-rules-source" class="ue-rock-sync-source">/ue-sync/semantic.rules.json</div>
```

- [ ] **Step 2: Query semantic mode elements**

In `public/src/editor.js`, query:

```js
const ueSemanticModeButton = document.querySelector("#ue-semantic-mode-button");
```

- [ ] **Step 3: Add imported scene display mode setter**

Add:

```js
function setImportedSceneDisplayMode(mode) {
  ueRockSync.setDisplayMode(mode);
  if (ueSemanticModeButton) {
    const semanticMode = ueRockSync.getDisplayMode() === "semanticColor";
    ueSemanticModeButton.classList.toggle("is-active", semanticMode);
    ueSemanticModeButton.textContent = semanticMode ? "Gray Mode" : "ID Color Mode";
  }
  render();
}
```

- [ ] **Step 4: Add viewer adaptation from manifest**

Add:

```js
function adaptImportedSceneToManifest(manifest) {
  const nextGridSize = Number(manifest?.gridSizeMeters);
  if (!Number.isFinite(nextGridSize) || nextGridSize <= gridSize) {
    return;
  }

  const gridScale = nextGridSize / gridSize;
  grid.scale.set(gridScale, gridScale, 1);
  shadowReceiver.scale.set(gridScale, gridScale, 1);
  gridOriginXLine.scale.set(gridScale, 1, 1);
  gridOriginYLine.scale.set(1, gridScale, 1);
  gridMaterial.uniforms.fadeDistance.value = nextGridSize / 2;
  camera.far = Math.max(camera.far, nextGridSize * 2);
  camera.updateProjectionMatrix();
}
```

- [ ] **Step 5: Configure controller URLs and onSynced**

Change controller options to:

```js
manifestUrl: "/ue-sync/scene.manifest.json",
fallbackManifestUrl: "/ue-sync/rocks.instances.json",
semanticRulesUrl: "/ue-sync/semantic.rules.json",
onSynced: (manifest) => {
  adaptImportedSceneToManifest(manifest);
  renderSceneOutliner();
}
```

- [ ] **Step 6: Add semantic mode click handler**

Add:

```js
ueSemanticModeButton?.addEventListener("click", () => {
  setImportedSceneDisplayMode(ueRockSync.getDisplayMode() === "semanticColor" ? "gray" : "semanticColor");
});
```

- [ ] **Step 7: Run GREEN verification**

Run:

```js
await import(`file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs?green=${Date.now()}`);
```

Expected: test completes without throwing.

## Task 5: Update UE Exporter For Scene Manifest v2

**Files:**
- Modify: `tools/unreal/sync_selected_static_mesh_rocks.py`
- Test: `tests/unreal-export-script.test.mjs`

**Interfaces:**
- Produces `scene.manifest.json`, `semantic.rules.json`, and the existing `rocks.instances.json`.
- Keeps `sync_selected_static_mesh_rocks()` as the callable entry point for existing UE workflows.

- [ ] **Step 1: Add new output constants**

Add:

```python
LEGACY_MANIFEST_PATH = OUTPUT_ROOT / "rocks.instances.json"
SCENE_MANIFEST_PATH = OUTPUT_ROOT / "scene.manifest.json"
SEMANTIC_RULES_PATH = OUTPUT_ROOT / "semantic.rules.json"
SEMANTIC_RULES_URL = "/ue-sync/semantic.rules.json"
DEFAULT_GRID_SIZE_METERS = 5000
```

Set `MANIFEST_PATH = LEGACY_MANIFEST_PATH` to keep old tests and workflows compatible.

- [ ] **Step 2: Add semantic rules and classifier**

Add:

```python
DEFAULT_SEMANTIC_RULES = {
    "classes": {
        "unclassified": {"id": 0, "color": "#ff00ff"},
        "wall": {"id": 12, "color": "#d14b4b"},
        "ground": {"id": 2, "color": "#4b8bd1"},
        "vegetation": {"id": 3, "color": "#58a65c"},
        "rock": {"id": 4, "color": "#8e8e8e"},
    },
    "rules": [
        {"if": {"assetPathContains": "Wall"}, "semantic": "wall"},
        {"if": {"materialContains": "Ground"}, "semantic": "ground"},
        {"if": {"blueprintClassContains": "Tree"}, "semantic": "vegetation"},
        {"if": {"assetPathContains": "Rock"}, "semantic": "rock"},
    ],
}

def semantic_for_metadata(asset_path="", actor_class="", actor_label_value="", material_slots=None):
    haystacks = {
        "assetPathContains": asset_path.lower(),
        "blueprintClassContains": actor_class.lower(),
        "actorLabelContains": actor_label_value.lower(),
        "materialContains": " ".join(material_slots or []).lower(),
    }
    for rule in DEFAULT_SEMANTIC_RULES["rules"]:
        conditions = rule.get("if", {})
        if all(str(expected).lower() in haystacks.get(key, "") for key, expected in conditions.items()):
            return rule["semantic"]
    return "unclassified"
```

- [ ] **Step 3: Add selected scene origin**

Add:

```python
def selected_scene_origin(actors) -> list[float]:
    locations = [actor.get_actor_location() for actor in actors]
    if not locations:
        return [0.0, 0.0, 0.0]
    min_x = min(location.x for location in locations)
    max_x = max(location.x for location in locations)
    min_y = min(location.y for location in locations)
    max_y = max(location.y for location in locations)
    min_z = min(location.z for location in locations)
    max_z = max(location.z for location in locations)
    return [(min_x + max_x) * 0.5, (min_y + max_y) * 0.5, (min_z + max_z) * 0.5]
```

- [ ] **Step 4: Add metadata helpers**

Add functions for `actor_class_name(actor)`, `actor_folder_path(actor)`, `actor_tags(actor)`, `component_tags(component)`, and `material_slot_names(static_mesh)` using `get_editor_property` when available and returning strings/lists.

- [ ] **Step 5: Add v2 component and actor records**

Add `scene_component_record(actor, component, mesh_file, index)` and `scene_actor_record(actor, components)` that produce the v2 shape with `transform`, `components`, `materialSlots`, `semantic`, and `colorId`.

- [ ] **Step 6: Build and write all manifests**

In `sync_selected_static_mesh_rocks()`, build both legacy `instances` and v2 `actors`, write `legacy_manifest` to `LEGACY_MANIFEST_PATH`, write `scene_manifest` to `SCENE_MANIFEST_PATH`, and write `DEFAULT_SEMANTIC_RULES` to `SEMANTIC_RULES_PATH`.

- [ ] **Step 7: Run GREEN verification**

Run:

```js
await import(`file:///D:/CompositionPipeline/tests/unreal-export-script.test.mjs?green=${Date.now()}`);
```

Expected: test completes without throwing.

## Task 6: Full Verification And Browser Smoke Test

**Files:**
- No production code unless verification finds a real bug.
- Verify: changed JS modules, Unreal Python script, and browser behavior.

- [ ] **Step 1: Run all static JS tests**

Run through Codex Node REPL:

```js
for (const test of [
  "file:///D:/CompositionPipeline/tests/ue-rock-sync.test.mjs",
  "file:///D:/CompositionPipeline/tests/unreal-export-script.test.mjs",
  "file:///D:/CompositionPipeline/tests/editor-architecture.test.mjs",
  "file:///D:/CompositionPipeline/tests/play-mode-controls.test.mjs"
]) {
  await import(`${test}?verify=${Date.now()}-${Math.random()}`);
}
```

Expected: all imports complete without throwing.

- [ ] **Step 2: Run Python compile check**

Run:

```powershell
python -m py_compile tools\unreal\sync_selected_static_mesh_rocks.py server.py
```

Expected: command exits with code `0`.

- [ ] **Step 3: Run whitespace diff check**

Run:

```powershell
git diff --check
```

Expected: command exits with code `0`.

- [ ] **Step 4: Browser reload and console check**

Use the in-app browser at:

```text
http://localhost:5173/?right-handle-test=1
```

Reload. Expected: no browser console errors, UE panel shows `Sync Selected UE Scene Proxies`, source shows `/ue-sync/scene.manifest.json`, and the ID color button is visible.

- [ ] **Step 5: Sync smoke test**

Click the UE tab, click sync. Expected: if `scene.manifest.json` exists, it loads v2; if it does not exist but legacy `rocks.instances.json` exists, it falls back to legacy and updates status without crashing.

- [ ] **Step 6: Semantic mode smoke test**

Click ID color mode. Expected: imported meshes switch to semantic colors if semantic metadata exists, otherwise magenta unclassified color; click again and meshes return to the shared gray material.

- [ ] **Step 7: Final status review**

Run:

```powershell
git status --short
git diff --stat
```

Expected: changed files are limited to the plan, tests, browser import/editor files, index, and UE script.

## Self-Review

- Spec coverage: Tasks 1-2 implement Manifest v2, sceneOrigin, transform rebasing, actor-level selection metadata, gray mode, semantic mode, and legacy fallback. Task 4 implements 5 km viewer adaptation and UI mode switching. Task 5 implements UE-side scene manifest and semantic rule export. Task 6 covers verification.
- Deferred coverage: Proxy mesh generation remains the existing glTF export plus browser simplification fallback; offline high-quality proxy generation, region streaming, and InstancedMesh batching are intentionally left for a later phase after manifest v2 is stable.
- Marker scan: The plan contains concrete paths, function names, command snippets, and expected results. It does not use unresolved marker text.
- Type consistency: The plan consistently uses `normalizeSceneSyncManifest`, `normalizeSemanticRules`, `sceneOrigin`, `gridSizeMeters`, `semanticRulesUrl`, `fallbackManifestUrl`, `setDisplayMode`, `getDisplayMode`, `setImportedSceneDisplayMode`, and `adaptImportedSceneToManifest`.
