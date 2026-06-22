# Sun Light System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draggable sun-light asset that casts directional shadows and can be aimed with the existing rotate transform tool.

**Architecture:** Treat `sun-light` as a normal scene asset so the existing drag, placement, selection, transform, undo, delete, and play-mode blocking paths continue to work. Keep `public/src/assets.js` responsible for creating the light helper and embedded `THREE.DirectionalLight`, while `public/src/editor.js` configures renderer shadows, mesh shadow flags, the ground receiver, and per-render light target sync.

**Tech Stack:** Browser-native ES modules, Three.js `DirectionalLight` shadows, Shoelace toolbar controls, existing Node static architecture tests, in-app browser verification.

---

## File Structure

- Modify `public/index.html`: make the Light toolbar button use `data-asset="sun-light"` and the existing draggable asset styling.
- Modify `public/src/assets.js`: add `createSunLight()`, return it from `createAsset("sun-light")`, and keep grid offset zero for non-cube assets.
- Modify `public/src/editor.js`: enable shadow maps, add a transparent ground shadow receiver, configure placed mesh shadows, and sync sun-light targets before rendering.
- Modify `tests/editor-architecture.test.mjs`: add static checks for the Light toolbar contract, sun-light factory, shadow renderer setup, mesh shadow setup, and light direction sync.
- Verify `tests/play-mode-controls.test.mjs`: run unchanged as a regression check because play mode blocks editor-only light placement while active.

## Scope Notes

- This plan does not add UI controls for light color, intensity, range, or softness.
- This plan does not add point, spot, area, or environment lights.
- This plan does not add scene saving.
- The current workspace already contains uncommitted editor files. When executing, stage only the files named in each task.

### Task 1: Add Failing Static Checks For The Sun-Light Asset Contract

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add Light toolbar assertions**

In `tests/editor-architecture.test.mjs`, in the existing `const index = read("public/index.html");` assertion block after the Character toolbar assertion, add:

```js
assert.match(index, /<sl-tooltip[^>]+content="Light"/);
assert.match(
  index,
  /<sl-icon-button[^>]+class="tool-button asset-button"[^>]+name="lightbulb"[^>]+data-asset="sun-light"[^>]+label="Light"/,
  "The Light toolbar button should drag out a sun-light asset"
);
assert.doesNotMatch(
  index,
  /data-system-tool="light"/,
  "The Light toolbar button should no longer be a dormant system tool"
);
```

- [ ] **Step 2: Add asset factory assertions**

Before the existing `const playMode = read("public/src/play-mode.js");` block, add:

```js
const assets = read("public/src/assets.js");
assert.match(assets, /export\s+function\s+createSunLight/);
assert.match(assets, /new\s+THREE\.DirectionalLight\(/);
assert.match(assets, /directionalLight\.castShadow\s*=\s*true/);
assert.match(assets, /userData\.sunLight\s*=/);
assert.match(assets, /userData\.sunLightTarget\s*=/);
assert.match(assets, /type\s*===\s*["']sun-light["']/);
assert.match(assets, /return\s+createSunLight\(options\)/);
assert.match(
  assets,
  /return\s+type\s*===\s*["']cube["']\s*\?\s*cubeSizeMeters\s*\/\s*2\s*:\s*0/,
  "Only cubes should use a half-cell placement offset"
);
```

- [ ] **Step 3: Run the architecture test and verify the expected failure**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: the command fails because the Light button still uses `data-system-tool="light"` or because `createSunLight` is not defined.

### Task 2: Implement The Draggable Sun-Light Asset

**Files:**
- Modify: `public/index.html`
- Modify: `public/src/assets.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Convert the Light button into a draggable asset**

In `public/index.html`, replace the Light button with:

```html
<sl-tooltip content="Light" placement="right">
  <sl-icon-button class="tool-button asset-button" name="lightbulb" data-asset="sun-light" label="Light"></sl-icon-button>
</sl-tooltip>
```

- [ ] **Step 2: Add `createSunLight()` to `public/src/assets.js`**

Add this function after `createCharacter()`:

```js
export function createSunLight() {
  const group = new THREE.Group();
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd45a,
    toneMapped: false
  });
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xffd45a,
    transparent: true,
    opacity: 0.82
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), markerMaterial);
  const rays = new THREE.Group();
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
  const lightTarget = new THREE.Object3D();

  marker.position.z = 1.8;
  marker.userData.lightHelper = true;

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const inner = new THREE.Vector3(Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 1.8);
    const outer = new THREE.Vector3(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 1.8);
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([inner, outer]), rayMaterial);

    ray.userData.pickable = false;
    ray.userData.lightHelper = true;
    rays.add(ray);
  }

  directionalLight.position.set(0, 0, 4);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 80;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  directionalLight.shadow.bias = -0.0005;

  lightTarget.position.set(0, -5, 0);
  directionalLight.target = lightTarget;

  group.add(marker, rays, directionalLight, lightTarget);
  group.userData.sunLight = directionalLight;
  group.userData.sunLightTarget = lightTarget;
  return group;
}
```

- [ ] **Step 3: Route `sun-light` through `createAsset()`**

Replace `createAsset()` with:

```js
export function createAsset(type, options) {
  if (type === "cube") {
    return createCube(options);
  }

  if (type === "sphere") {
    return createSphere(options);
  }

  if (type === "sun-light") {
    return createSunLight(options);
  }

  return createCharacter(options);
}
```

- [ ] **Step 4: Make only cubes use a half-cell grid offset**

Replace `getAssetGridOffset()` with:

```js
export function getAssetGridOffset(assetOrType, { cubeSizeMeters }) {
  const type = typeof assetOrType === "string"
    ? assetOrType
    : assetOrType.userData.assetType;

  return type === "cube" ? cubeSizeMeters / 2 : 0;
}
```

- [ ] **Step 5: Run syntax and static checks**

Run:

```powershell
node --check public/src/assets.js
node tests/editor-architecture.test.mjs
```

Expected: `public/src/assets.js` has no syntax errors. The Task 1 assertions pass; the test may still fail later if Task 3 assertions have already been added.

- [ ] **Step 6: Commit or checkpoint the asset contract**

If committing is appropriate for the current dirty workspace, run:

```powershell
git add public/index.html public/src/assets.js tests/editor-architecture.test.mjs
git commit -m "feat: add draggable sun light asset"
```

Expected: only the Light toolbar conversion, asset factory, and Task 1 tests are staged. If not committing, leave the files unstaged and record the checkpoint in `_codex_state.md`.

### Task 3: Add Failing Static Checks For Shadows And Light Direction Sync

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add editor shadow setup assertions**

In the existing `const editor = read("public/src/editor.js");` assertion block, near the renderer and grid assertions, add:

```js
assert.match(editor, /renderer\.shadowMap\.enabled\s*=\s*true/);
assert.match(editor, /renderer\.shadowMap\.type\s*=\s*THREE\.PCFSoftShadowMap/);
assert.match(editor, /const\s+shadowReceiver\s*=\s*new\s+THREE\.Mesh\(/);
assert.match(editor, /new\s+THREE\.ShadowMaterial\(/);
assert.match(editor, /shadowReceiver\.receiveShadow\s*=\s*true/);
assert.match(editor, /shadowReceiver\.userData\.pickable\s*=\s*false/);
```

- [ ] **Step 2: Add mesh shadow configuration assertions**

In the same editor assertion block, add:

```js
assert.match(editor, /function\s+configureAssetShadows\(asset\)/);
assert.match(editor, /child\.castShadow\s*=\s*true/);
assert.match(editor, /child\.receiveShadow\s*=\s*true/);
assert.match(editor, /child\.userData\.lightHelper/);
assert.match(editor, /configureAssetShadows\(asset\)/);
```

- [ ] **Step 3: Add sun-light sync assertions**

In the same editor assertion block, add:

```js
assert.match(editor, /function\s+syncSunLightDirection\(asset\)/);
assert.match(editor, /asset\.userData\.assetType\s*!==\s*["']sun-light["']/);
assert.match(editor, /asset\.userData\.sunLight/);
assert.match(editor, /asset\.userData\.sunLightTarget/);
assert.match(editor, /function\s+syncSceneLights\(\)/);
assert.match(editor, /placedAssets\.forEach\(syncSunLightDirection\)/);
assert.match(editor, /syncSceneLights\(\);[\s\S]*renderSceneToActiveViewport\(\);/);
```

- [ ] **Step 4: Run the architecture test and verify the expected failure**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: the command fails because `renderer.shadowMap.enabled` or `configureAssetShadows()` is not implemented yet.

### Task 4: Implement Shadow Rendering And Sun-Light Direction Sync

**Files:**
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`
- Test: `tests/play-mode-controls.test.mjs`

- [ ] **Step 1: Enable shadow maps on the main renderer**

In `public/src/editor.js`, immediately after `renderer.setSize(initialViewport.width, initialViewport.height);`, add:

```js
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

- [ ] **Step 2: Add a transparent shadow receiver near the visible grid**

Immediately before the existing `const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);`, add:

```js
const shadowReceiver = new THREE.Mesh(
  new THREE.PlaneGeometry(gridSize, gridSize, 1, 1),
  new THREE.ShadowMaterial({
    color: 0x000000,
    opacity: 0.24,
    transparent: true
  })
);

shadowReceiver.name = "ground-shadow-receiver";
shadowReceiver.position.z = -0.01;
shadowReceiver.receiveShadow = true;
shadowReceiver.userData.pickable = false;
scene.add(shadowReceiver);
```

- [ ] **Step 3: Add helpers for mesh shadow flags and sun-light sync**

Add these functions after `copyCameraState()` and before `resizeCapturedCameraPreview()`:

```js
function configureAssetShadows(asset) {
  asset.traverse((child) => {
    if (!child.isMesh || child.userData.lightHelper) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function syncSunLightDirection(asset) {
  if (asset.userData.assetType !== "sun-light") {
    return;
  }

  const light = asset.userData.sunLight;
  const target = asset.userData.sunLightTarget;

  if (!light || !target) {
    return;
  }

  asset.updateMatrixWorld(true);
  light.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
}

function syncSceneLights() {
  placedAssets.forEach(syncSunLightDirection);
}
```

- [ ] **Step 4: Configure shadows when an asset is marked**

In `markAsset(asset, type)`, after the `asset.traverse((child) => { ... });` block and before `placedAssets.push(asset);`, add:

```js
configureAssetShadows(asset);
```

- [ ] **Step 5: Sync scene lights before every render pass**

At the start of `render()`, before `renderSceneToActiveViewport();`, add:

```js
syncSceneLights();
```

The function should keep this order:

```js
function render() {
  syncSceneLights();
  renderSceneToActiveViewport();
  selectionOutline.render(selectedAsset, selectionOutlineVisible);
  renderCapturedCameraPreviews();
}
```

- [ ] **Step 6: Enable shadows in captured camera preview renderers**

In `capturePlayerCamera()`, immediately after `previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));`, add:

```js
previewRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
previewRenderer.shadowMap.type = renderer.shadowMap.type;
```

- [ ] **Step 7: Run syntax and static checks**

Run:

```powershell
node --check public/src/editor.js
node tests/editor-architecture.test.mjs
node tests/play-mode-controls.test.mjs
```

Expected: all commands exit with code `0`.

- [ ] **Step 8: Commit or checkpoint shadow support**

If committing is appropriate for the current dirty workspace, run:

```powershell
git add public/src/editor.js tests/editor-architecture.test.mjs
git commit -m "feat: add sun light shadows"
```

Expected: only the editor shadow implementation and Task 3 tests are staged. If not committing, leave the files unstaged and record the checkpoint in `_codex_state.md`.

### Task 5: Browser Verification

**Files:**
- No code changes unless verification reveals a bug in the files changed by Tasks 2 or 4.
- Verify: `http://127.0.0.1:5173/`

- [ ] **Step 1: Confirm static checks still pass**

Run:

```powershell
node --check public/src/assets.js
node --check public/src/editor.js
node tests/editor-architecture.test.mjs
node tests/play-mode-controls.test.mjs
git diff --check
```

Expected: Node commands exit with code `0`. `git diff --check` exits with code `0`; line-ending normalization warnings are acceptable if there are no whitespace-error lines.

- [ ] **Step 2: Reload the existing in-app browser page**

Use the in-app browser tab currently at `http://127.0.0.1:5173/` and reload it after code changes.

Expected: the page loads without `error` level console logs.

- [ ] **Step 3: Verify Light drag placement**

In the browser:

```text
Drag the Light toolbar button into the scene.
Confirm a visible yellow sun helper appears on the ground.
Click the helper.
Confirm the transform toolbar appears and the selection outline is visible.
```

- [ ] **Step 4: Verify shadows**

In the browser:

```text
Drag a Cube into the scene near the sun-light.
Confirm the cube is lit and casts a visible shadow onto the ground.
Drag a Character into the scene.
Confirm the character also casts a visible shadow.
```

- [ ] **Step 5: Verify rotation changes direction**

In the browser:

```text
Select the sun-light.
Switch the transform toolbar to Rotate.
Rotate the sun-light around the vertical axis.
Confirm the cube or character shadow direction changes after rotation.
```

- [ ] **Step 6: Verify cleanup paths**

In the browser:

```text
Delete the selected sun-light.
Confirm the helper and its shadow effect leave the scene.
Use Ctrl+Z after placing a new sun-light.
Confirm undo removes the sun-light and the app remains responsive.
Enter and exit Run mode with a character.
Confirm light placement and transform editing are blocked while playing and return after Escape.
```

- [ ] **Step 7: Final diff review**

Run:

```powershell
git diff --stat
git diff -- public/index.html public/src/assets.js public/src/editor.js tests/editor-architecture.test.mjs _codex_state.md
```

Expected: changes are limited to the sun-light toolbar contract, asset factory, shadow rendering, tests, and the scratch state update.

## Self-Review

- Spec coverage: Tasks 1 and 2 convert the Light button into a draggable `sun-light` asset and keep placement on the current asset flow. Tasks 3 and 4 enable shadows, configure ordinary mesh shadow flags, add the ground receiver, and sync the directional light target through the sun-light transform. Task 5 verifies selection, shadows, rotation, deletion, undo, and play-mode blocking.
- Placeholder scan: The plan contains no placeholder markers or incomplete implementation steps. Each code-changing step includes the exact snippet to add or replace.
- Type consistency: The plan consistently uses `createSunLight`, `sun-light`, `userData.sunLight`, `userData.sunLightTarget`, `configureAssetShadows`, `syncSunLightDirection`, and `syncSceneLights`.
