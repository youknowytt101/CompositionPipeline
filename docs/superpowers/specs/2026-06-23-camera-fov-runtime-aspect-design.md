# Camera FOV And Runtime Aspect Design

## Goal

Give the editor separate controls for camera FOV and runtime output aspect ratio, while keeping the camera behavior consistent across edit mode, play mode, and captured previews.

## User Requirements

- FOV and aspect ratio must be adjustable independently.
- FOV is a shared camera setting. Changing it in the editor affects both the 3D editing camera and the runtime/play camera.
- Runtime aspect ratio is not an editor viewport layout setting. Changing it must not resize, crop, or letterbox the editing viewport canvas.
- Runtime aspect ratio should support presets and custom width/height values.
- Captured camera previews in the right panel should match the runtime camera projection and captured aspect ratio instead of being forced to a fixed 16:9 card.

## Scope

Included:
- Add one shared camera settings state for FOV and runtime aspect ratio.
- Add UI controls for FOV, aspect presets, and custom aspect width/height.
- Apply FOV to the single existing `THREE.PerspectiveCamera` used by both editing and play mode.
- Keep the editing viewport camera aspect synced to the actual editor canvas aspect.
- Apply runtime aspect ratio to the play-mode frame and camera projection while playing.
- Capture camera previews with the current FOV and runtime aspect ratio.
- Render right-panel preview cards using the captured aspect ratio without stretching.

Excluded:
- Separate edit and runtime camera objects.
- Saved project files or persistence across reloads.
- Per-camera assets, camera timelines, or shot sequencing.
- Changing editor viewport layout to match runtime aspect ratio.

## Architecture

`public/src/editor.js` remains the integration layer. It will own a small `cameraSettings` object containing:

- `fov`
- `runtimeAspectWidth`
- `runtimeAspectHeight`

The existing main `THREE.PerspectiveCamera` remains shared between edit and play mode. A helper will apply the shared FOV and the correct aspect for the current mode:

- Edit mode aspect: actual editor canvas aspect.
- Play mode aspect: `runtimeAspectWidth / runtimeAspectHeight`.

The play viewport frame will get its CSS aspect ratio from the same runtime aspect setting. The frame is a runtime/output guide only; it does not determine the editor canvas size.

## UI Design

Use the existing left panel for camera/output controls. Add compact controls rather than another floating toolbar:

- FOV slider plus numeric value, default `60`.
- Runtime aspect preset control with `16:9`, `4:3`, `1:1`, and `9:16`.
- Custom width and height numeric inputs that update the runtime aspect.

When a preset is selected, it updates the width/height values. When custom width or height is edited, the runtime aspect becomes custom.

## Data Flow

1. User changes FOV.
2. Editor updates `cameraSettings.fov`.
3. Editor assigns `camera.fov`, updates the projection matrix, refreshes previews, and renders.
4. User changes runtime aspect.
5. Editor updates `cameraSettings.runtimeAspectWidth/Height`.
6. Play-mode frame CSS updates to the new aspect.
7. If play mode is active, the main camera projection uses the runtime aspect.
8. If edit mode is active, the main camera projection keeps using the editor canvas aspect.
9. Capturing a runtime camera stores the camera state and aspect at capture time.
10. Right-panel preview cards use their captured aspect ratio for both layout and render bounds.

## Captured Preview Behavior

Each captured preview stores:

- The copied camera.
- The captured aspect ratio.
- Its preview canvas and renderer.

The preview card uses CSS `aspect-ratio` equal to the captured aspect ratio. The preview renderer draws into the largest matching viewport inside the card, preserving projection and avoiding stretch.

Existing captured previews should not be retroactively changed when the user later changes FOV or runtime aspect. They represent the camera state at the time of capture.

## Error Handling

FOV input will be clamped to a safe range, such as `20` to `100` degrees.

Custom aspect width and height will be clamped to positive values. If either custom value is invalid or zero, the editor keeps the last valid runtime aspect.

If the user clicks Run without a character, play mode still does not start. Camera settings remain editable.

## Testing

Static architecture tests should assert:

- The editor has a shared `cameraSettings` object.
- FOV is applied through `camera.fov`.
- Edit-mode aspect still comes from the editor canvas.
- Play-mode aspect comes from runtime settings.
- The play viewport frame aspect is updated from runtime settings.
- Captured previews store and render with a captured aspect instead of a fixed 16:9 card.

Browser verification should cover:

- Editing FOV changes the visible perspective in edit mode.
- The same FOV is used after entering play mode.
- Changing runtime aspect does not change the editing canvas dimensions.
- Entering play mode shows a frame matching the selected aspect ratio.
- Capturing the camera creates a right-panel preview card matching the runtime aspect.
- Changing runtime aspect after capture does not mutate older preview cards.
