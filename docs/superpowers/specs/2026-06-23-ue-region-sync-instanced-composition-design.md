# UE Region Sync, Instancing, and Composition Preview Design

## Status

This document extends the existing
`2026-06-23-ue-scene-proxy-semantic-pipeline-design.md`. That design already
defines Manifest v2, `sceneOrigin` rebasing, coordinate conversion, semantic
rules, gray/semantic display modes, and a phased plan. It explicitly defers
**InstancedMesh batching** and **region streaming** to "Phase 5".

This document specifies that deferred work, because the new product goal makes
it the critical path rather than a nice-to-have.

## New Goal

Select **all elements of an entire UE map, or all elements of a chosen region**,
sync them into the Three.js scene as one operation, and use the web editor to do
**composition optimization preview** (spatial review, framing, layout judgment).

This changes the scale assumption from "72 test actors" to "thousands to tens of
thousands of instances". At that scale the current importer cannot work, for a
structural reason, not a tuning reason.

## Why The Current Importer Cannot Reach The Goal

The importer in `public/src/ue-rock-sync.js` places one `THREE.Mesh` per
instance (geometry is cached via `meshCache`, but each placed instance is an
independent `template.clone(true)` added to the scene group).

Consequence: **N instances produce N draw calls.** The current test data is 72
actors using only **4 unique meshes**, which already shows the pattern: huge
repetition, few unique assets. A full map is the same shape at 100-1000x the
count. Per-mesh rendering will stall the browser long before a full map loads.

The data is ideally suited to GPU instancing precisely because it is highly
repetitive. This is the core fix.

## Pillar 1: InstancedMesh Rendering (performance hard gate)

### Approach

Group placed instances by **(unique mesh) x (display material)**. For each
group, allocate one `THREE.InstancedMesh` sized to the group's instance count,
and write each instance's local matrix with `setMatrixAt`.

```text
ImportedSceneRoot
  RegionGroup (per world tile)
    InstancedBatch  (one per unique-mesh x material-mode)
      instanceId 0..n -> matrix, semantic, colorId, sourceActorId
```

Draw calls drop from `instanceCount` to `uniqueMeshCount x activeMaterialCount`.
For the current data that is 72 -> ~4.

### Picking with instancing

Per-instance picking must be preserved (composition work needs selection).
`THREE.Raycaster` reports `intersection.instanceId` on an `InstancedMesh`. Keep a
parallel array per batch mapping `instanceId -> { actorId, componentId, semantic,
colorId }`, so a hit resolves back to the source actor. Selection highlight can
be done by overriding `setColorAt` on the hit instance, or by drawing a
lightweight outline box at the instance matrix.

### Display modes with instancing

The existing gray/semanticColor modes still hold, but implemented per batch:

- `gray`: one shared gray material; batches keyed by mesh only.
- `semanticColor`: use `instanceColor` (`setColorAt`) so a single batch per mesh
  can still show per-instance semantic colors without splitting into one batch
  per class. This keeps draw calls minimal even in semantic mode.

### Transforms

Each instance matrix is the already-converted Three.js local matrix (UE cm ->
m, axis mirror, quaternion conversion, `sceneOrigin` rebasing) from the existing
shared transform path. Instancing changes only **how** the matrix is submitted,
not the conversion math. No import path should re-derive transforms.

### What changes in code

- `public/src/ue-rock-sync.js`: replace the per-instance `clone()` placement
  loop with a two-pass build: pass 1 counts instances per (mesh, mode); pass 2
  fills `InstancedMesh` matrices and per-instance metadata arrays. Keep the
  `meshCache` for geometry. Keep terrain proxies as regular meshes (few, large).
- Picking and outline code in `editor.js` must learn to resolve `instanceId`.

### Non-instanced exceptions

Terrain/landscape proxies and any unique one-off mesh stay as normal meshes.
Instancing is only worth it above a small repeat count (e.g. >= 4 instances of a
mesh); below that, place normally.

## Pillar 2: Region Selection Export (both manual and volume)

The goal explicitly asks for two selection paths. Both produce the **same
Manifest v2 package**; they differ only in how the UE exporter chooses actors.

### Mode A: Manual actor selection (already exists)

`sync_selected_static_mesh_rocks.py` already exports
`get_selected_level_actors()`. This remains the simple path: select actors in
the UE viewport, run the menu command. No change needed beyond Pillar 3 output.

### Mode B: Spatial region / bounding volume

Add an export path that gathers **all actors whose bounds intersect a chosen
world-space region**, instead of relying on manual selection.

Region source options, in increasing effort:

1. **Bounds of current selection**: take the selected actors' combined bounding
   box, then expand to include every actor intersecting that box. Lets the user
   "rough select a few, capture everything around them".
2. **Explicit box volume actor**: read a chosen `ATriggerBox` / volume actor's
   bounds as the region. Artist places/sizes a box in UE to mark the region.
3. **Numeric extent**: a min/max XY (and optional Z) passed to the exporter.

Implementation in the exporter:

```python
def actors_in_region(min_xy, max_xy):
    out = []
    for actor in all_level_actors():
        origin, extent = actor.get_actor_bounds(only_colliding=False)
        if box_intersects_2d(origin, extent, min_xy, max_xy):
            out.append(actor)
    return out
```

The rest of the pipeline (proxy export, manifest, semantic rules, sceneOrigin)
is unchanged — `sceneOrigin` is computed from the resolved actor set's bounding
box center, exactly as the existing design specifies, so a region export lands
near the Three.js origin automatically.

### Whole-map export

"Entire map" is just Mode B with a region covering the full world bounds (or no
region filter = all level actors). Guard it: full-map exports can be enormous, so
the exporter should report the resolved actor/mesh/instance counts and total GLB
size before writing, and optionally require confirmation past a threshold.

## Pillar 3: Incremental / Additive Sync

A map or several regions will be synced in pieces. The importer currently calls
`clear()` and rebuilds. For region-by-region work it must support **append**.

### Manifest changes

Add a `regionId` (and optional `regionBounds`) to Manifest v2 at the top level.
Each export is tagged with its region.

### Importer changes

- `sync({ mode: "replace" | "append" })`. Default stays `replace` for the
  single-shot whole-map case; region workflows use `append`.
- Keep a registry of loaded `regionId`s. Re-syncing the same `regionId` replaces
  only that region's `RegionGroup`/batches, not the whole scene.
- Instanced batches are per-region (see Pillar 1 tree), so adding/removing a
  region is a localized operation.

## Pillar 4: Composition Preview Runtime

These are the features that make the imported scene actually useful for framing
and layout judgment, beyond just "it loads".

### Culling and distance handling

Even instanced, tens of thousands of instances over a large area need help:

- **Per-region visibility**: cull whole `RegionGroup`s by distance / frustum,
  so far tiles cost nothing. The existing design already lists
  "optional hidden-by-default distant regions".
- **Camera far / grid from manifest**: already handled by
  `adaptImportedSceneToManifest` using `gridSizeMeters`. Extend it to also set a
  sensible fog/fade so distant repeated geometry reads as background.

### Composition-specific helpers (new)

- **Semantic isolation**: show only one semantic class (e.g. only `vegetation`)
  to judge its distribution — already partially anticipated as an optional mode.
- **Density / heatmap proxy**: optionally render dense classes (grass, foliage)
  as a flat colored ground decal instead of thousands of instances, since for
  composition their *mass and color*, not individual meshes, matter.
- **Framing aids**: rule-of-thirds / aspect overlay already exists via the
  runtime aspect frame; ensure it composes with imported scenes.

## Performance Targets (proposed)

- 10k instances across <= 50 unique meshes: interactive (> 30 fps) orbit.
- Sync of a single region (<= a few thousand instances) completes without
  freezing the main thread for more than a short, status-reported beat.
- Switching gray <-> semantic does not reload geometry (already a requirement;
  with `instanceColor` it also does not rebuild batches).

## Phased Delivery (extends existing Phase 5)

### Phase 5a: InstancedMesh batching (this is the unlock)

Rewrite the importer placement loop to build `InstancedMesh` batches with
per-instance metadata and `instanceId` picking. Verify with a synthetic
multi-thousand-instance manifest before touching UE. **Highest priority.**

### Phase 5b: Draco/Meshopt geometry compression

Enable Draco in the UE GLTF export options; add `DRACOLoader` in the browser.
Cuts download and memory for large maps. Independent of 5a, pairs well.

### Phase 5c: Region export (Mode B) + additive sync

Add region-resolution to the exporter and `append`/`regionId` to the importer.

### Phase 5d: Composition preview helpers

Per-region culling/fade, semantic isolation, density decals, framing aids.

## Risks and Notes

- **editor.js is fragile to bulk edits in this workspace.** The instancing
  picking changes touch `editor.js`; use the file-editing tool against the real
  disk path and verify completeness via the browser, not the sandbox shell. See
  the project memory note on this.
- **Instanced picking + outline** is the most involved code change; budget for it.
- **`instanceColor` semantic mode** must handle the unclassified magenta case.
- **Whole-map size guardrail** is important; an unbounded full-map export can
  produce gigabytes of GLB.
- Keep the legacy `rocks.instances.json` fallback intact throughout.

## Acceptance Criteria

- A synthetic manifest with several thousand repeated instances imports and
  orbits interactively, with draw calls on the order of unique-mesh count.
- Clicking an instanced object selects the correct source actor (resolved via
  `instanceId`).
- Gray and semantic color modes both work on instanced batches without
  geometry reload.
- A region export (Mode B) and a manual selection export (Mode A) both produce a
  loadable Manifest v2 package, rebased to the origin via `sceneOrigin`.
- Re-syncing one region in `append` mode updates only that region.
