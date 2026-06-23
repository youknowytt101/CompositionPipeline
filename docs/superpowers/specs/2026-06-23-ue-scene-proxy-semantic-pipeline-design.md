# UE Scene Proxy Semantic Pipeline Design

## Goal

Import large Unreal Engine scenes, around 5 km scale, into the Three.js editor as fast gray proxy scenes while preserving enough metadata for semantic classification, semantic filtering, and stable ID-color rendering.

The target runtime scene is not a full-fidelity UE scene. It is a lightweight composition and analysis scene:

- gray model display for spatial review;
- actor and component selection;
- semantic classification by rules first;
- semantic ID-color display;
- later AI-assisted semantic cleanup.

## Recommended Direction

Use UE as the authoritative exporter for scene structure, transforms, metadata, and proxy assets. Use Three.js as the fast viewer, semantic renderer, and interaction surface.

The browser should not be responsible for heavy production-time mesh processing. It can keep a lightweight fallback simplifier for small tests, but the long-term path should load prebuilt proxy GLBs.

## Scene Package

The UE export writes a scene package under `public/ue-sync/`:

```text
ue-sync/
  scene.manifest.json
  semantic.rules.json
  meshes/
    <stable-mesh-id>_proxy.glb
```

`scene.manifest.json` describes instances and metadata. `meshes/` stores unique proxy mesh assets. `semantic.rules.json` maps metadata patterns to semantic classes and ID colors.

## Manifest v2

The manifest should move from a rock-specific file toward a scene-level schema:

```json
{
  "schema": "composition-pipeline.ue-scene.v2",
  "unit": "centimeter",
  "sceneUnit": "meter",
  "coordinateSystem": "unreal-z-up",
  "sceneOrigin": [120000.0, -45000.0, 0.0],
  "gridSizeMeters": 5000,
  "assetsBaseUrl": "/ue-sync/meshes/",
  "actors": [
    {
      "id": "BP_Ruin_001",
      "label": "BP_Ruin_001",
      "class": "BP_RuinWall",
      "folderPath": "Ruins/Wall",
      "tags": ["ruin", "wall"],
      "semantic": "wall",
      "colorId": 12,
      "transform": {
        "location": [0.0, 0.0, 0.0],
        "quaternion": [0.0, 0.0, 0.0, 1.0],
        "scale": [1.0, 1.0, 1.0]
      },
      "components": [
        {
          "id": "BP_Ruin_001_ProxyMesh",
          "name": "ProxyMesh",
          "type": "StaticMeshComponent",
          "mesh": "SM_RuinWall_proxy.glb",
          "meshAssetPath": "/Game/Art/Scene/Ruins/SM_RuinWall",
          "materialSlots": ["M_Stone"],
          "tags": [],
          "semantic": "wall",
          "colorId": 12,
          "transform": {
            "location": [0.0, 0.0, 0.0],
            "quaternion": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0]
          }
        }
      ]
    }
  ]
}
```

Actor and component transforms should be exported as world transforms. The Three.js importer converts component world transforms into actor-local transforms when grouping objects.

## Scene Origin

For 5 km scenes, UE world coordinates must be rebased.

The exporter computes a `sceneOrigin` from the selected actors, preferably the selected-set bounding box center. It stores actor and component locations relative to this origin:

```text
exportedLocation = unrealWorldLocation - sceneOrigin
```

This keeps Three.js coordinates near the origin and reduces precision issues in picking, transform controls, camera movement, and outlines.

## Coordinate Conversion

The importer owns the UE-to-Three conversion:

- UE centimeters become Three meters.
- UE Z remains Three Z.
- UE Y is mirrored into Three Y.
- UE quaternion is converted consistently with that mirrored axis.

All rotation handling should go through a shared transform conversion function. No import path should hand-roll position or quaternion conversion.

## Proxy Meshes

Each unique StaticMesh asset should export one reusable proxy GLB. Multiple actors and components reference that same file.

Proxy generation goals:

- gray material only;
- no original textures;
- no vertex colors unless explicitly needed;
- reduced geometry;
- enough silhouette for spatial judgment;
- stable mesh filename based on asset path hash.

First implementation can keep browser-side simplification as fallback. The target implementation should generate proxies during export or in an offline preprocessing step.

Suggested reduction defaults:

```text
architecture / wall: 10-20 percent retained
rock / ruin debris: 5-15 percent retained
vegetation: simple proxy or very low percent retained
ground / road: preserve broad outline, remove detail
small props: optional omission or very low proxy
```

## Semantic Classification

Semantic classification starts with deterministic rules, not AI. Rules are faster, easier to debug, and stable across exports.

Rule inputs:

- actor tags;
- component tags;
- Blueprint class name;
- actor label;
- component name;
- StaticMesh asset path;
- material slot names;
- folder or layer path.

Example:

```json
{
  "classes": {
    "wall": { "id": 12, "color": "#d14b4b" },
    "ground": { "id": 2, "color": "#4b8bd1" },
    "vegetation": { "id": 3, "color": "#58a65c" }
  },
  "rules": [
    { "if": { "assetPathContains": "/Wall/" }, "semantic": "wall" },
    { "if": { "blueprintClassContains": "Tree" }, "semantic": "vegetation" },
    { "if": { "materialContains": "Ground" }, "semantic": "ground" }
  ]
}
```

AI-assisted semantic labeling can be added later as a review or suggestion layer. It should write back to the same semantic fields rather than creating a separate rendering path.

## Three.js Runtime Organization

The imported scene should be grouped for selection, filtering, and future streaming:

```text
ImportedSceneRoot
  RegionGroup
    ActorGroup
      ComponentGroup
        MeshInstance
```

The ActorGroup is the default selection target. ComponentGroup keeps component metadata and local transform. MeshInstance holds the proxy geometry and material.

## Rendering Modes

The runtime supports at least two material modes:

- `gray`: all imported meshes use a shared gray material.
- `semanticColor`: each semantic class uses a cached ID-color material.

Optional modes:

- selected semantic only;
- isolate one actor;
- show unclassified objects;
- show original source grouping.

Materials should be cached by semantic class or color ID. Do not create one material per mesh unless required.

## Large Scene Performance

Minimum viable performance features:

- stable mesh cache by mesh URL;
- material cache by display mode and semantic ID;
- actor/component metadata stored in `userData`;
- imported scene root separated from editor-created local assets;
- grid size and camera far adjusted from manifest scene bounds.

Second phase:

- region grouping by world tile;
- batched async loading;
- optional hidden-by-default distant regions;
- InstancedMesh for repeated mesh and semantic combinations;
- accelerated picking for large imported scenes.

## Phased Delivery

### Phase 1: Manifest v2 and Scene Origin

Add `scene.manifest.json`, `sceneOrigin`, actor/component metadata, and consistent world transform export. Three.js loads the new manifest while keeping the current legacy file as fallback.

### Phase 2: 5 km Viewer Adaptation

Adjust grid size, camera far, focusing, and import root placement from manifest bounds.

### Phase 3: Semantic Rules and ID Colors

Add `semantic.rules.json`, deterministic semantic classification, gray/semantic display modes, and material caching.

### Phase 4: Proxy Mesh Pipeline

Move simplification out of the browser and into UE/offline proxy generation. Keep browser simplification as fallback for legacy exports.

### Phase 5: Streaming and Instancing

Add region loading and instancing for very large scenes.

## Non-Goals For First Pass

- full-fidelity UE material reproduction;
- exact landscape rendering;
- runtime AI labeling;
- full Nanite-style reduction;
- complete UE level streaming replication.

## Acceptance Criteria

- A selected UE scene around 5 km imports around the Three.js origin using `sceneOrigin`.
- Multiple selected Blueprint Actors preserve relative position and rotation.
- Repeated StaticMesh assets reuse one proxy GLB.
- Imported actors are selectable as actor-level groups.
- Gray mode and semantic color mode can be switched without reloading geometry.
- Unclassified objects are visibly identifiable.
- Semantic class and color ID can be traced back to source metadata.
