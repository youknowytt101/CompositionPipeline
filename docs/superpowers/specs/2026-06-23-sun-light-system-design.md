# Sun Light System Design

## Goal

Clicking and dragging the existing Light toolbar button should place a simple sun-style directional light in the scene. Placed meshes should respond to scene lighting and cast shadows onto the ground so the editor starts to feel like a basic composition tool rather than an unlit object placer.

## Scope

Included:
- Convert the existing Light toolbar button into a draggable scene asset.
- Place a `sun-light` object on the ground using the current asset drag flow.
- Make the sun-light selectable, undoable, deletable, movable, and rotatable through existing editor tools.
- Use rotation to control the directional light direction.
- Enable renderer shadow maps.
- Configure ordinary scene meshes to cast and receive shadows.
- Add a ground-level shadow receiver so shadows are visible on the editor floor.
- Keep the default ambient fill light so objects remain readable.

Excluded from this iteration:
- Light color, intensity, shadow softness, or range controls in the side panels.
- Multiple light types such as point lights, spotlights, area lights, or HDR environment lighting.
- Gizmo-specific light direction handles or target objects.
- Saved scene serialization.
- Physically accurate sun position or time-of-day controls.

## Architecture

The first version should treat `sun-light` as another asset type. `public/src/assets.js` owns the factory for the visual helper and embedded `THREE.DirectionalLight`. `public/src/editor.js` remains the integration point for placement, selection, transform controls, undo, and render configuration.

The Light button should use the same `data-asset` path as Cube, Sphere, and Character. This keeps drag preview, ground hit testing, placement, selection, and undo behavior on one path.

## Components

`assets.js`:
- Add `createSunLight(options)`.
- Create a small visible helper, such as a sun disk with short rays or a simple emissive marker.
- Include a `THREE.DirectionalLight` associated with the asset.
- Mark decorative helper parts that should not participate in picking when needed.
- Expose `sun-light` through `createAsset(type, options)`.
- Return zero grid offset for `sun-light`.

`editor.js`:
- Enable `renderer.shadowMap.enabled`.
- Use a shadow map type suitable for soft but inexpensive editor shadows.
- Add a ground shadow receiver beneath or alongside the visible grid.
- Configure placed mesh assets to cast and receive shadows.
- Keep the helper geometry visible and selectable, but avoid making helper-only line work cast shadows.
- Update the directional light target from the sun-light transform so rotation changes the light direction.
- Ensure duplicating a sun-light creates an independent light and target.

`index.html`:
- Change the Light toolbar button from `data-system-tool="light"` to `data-asset="sun-light"` and give it the same draggable affordance as other asset buttons.

## Data Flow

1. User starts dragging the Light toolbar button.
2. Existing asset drag state records `type: "sun-light"`.
3. User releases over the ground plane.
4. Editor calls `placeAsset("sun-light", point)`.
5. Asset factory creates a selectable visual helper with a directional light.
6. Editor marks and registers the asset like other placed objects.
7. Each render or transform update syncs the light direction from the asset rotation.
8. Renderer draws lit meshes and their shadows onto the ground receiver.

## Interaction Details

The placed sun-light should initially point diagonally downward so shadows are visible immediately after placement. Moving the asset changes where the helper appears in the editor. Rotating the asset changes the light direction; the object can still use existing rotate snapping.

Scale is allowed for consistency with the current transform toolbar, but it only affects the visible helper unless a later design adds explicit light size controls.

During play mode, light placement and transform editing remain blocked by the same rules that block other editor-only interactions.

## Error Handling

If the user drops the light outside the ground plane, no light is created, matching current asset behavior. If a sun-light is deleted, its embedded directional light and target should leave the scene with the asset. If no sun-light exists, the existing default lighting should still keep the scene visible.

## Testing

Static tests should assert:
- The Light button uses `data-asset="sun-light"` and the asset button class.
- `assets.js` exports or defines `createSunLight`.
- `createAsset()` handles `sun-light`.
- `getAssetGridOffset()` returns zero offset for `sun-light`.
- The editor enables `renderer.shadowMap.enabled`.
- The editor creates a shadow receiver.
- The editor configures mesh `castShadow` and `receiveShadow`.
- The editor has a light direction sync path for `sun-light`.

Browser verification should cover:
- Drag the Light button into the scene.
- Confirm a visible sun-light helper appears and can be selected.
- Add a cube or character and confirm it casts a shadow on the ground.
- Rotate the sun-light and confirm the shadow direction changes.
- Delete or undo the sun-light and confirm the scene remains usable.
