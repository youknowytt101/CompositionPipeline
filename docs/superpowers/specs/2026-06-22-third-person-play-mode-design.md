# Third-Person Play Mode Design

## Goal

When a character has been placed in the scene, clicking the Run button enters a third-person play mode where the user can control that character like a simple game prototype. The first version focuses on movement, camera follow, and clean mode switching.

## Scope

Included:
- Enter play mode from the existing Run toolbar button.
- Use the selected character as the player when possible; otherwise use the first placed character.
- Move the character with `W`, `A`, `S`, and `D`.
- Rotate the third-person camera with mouse movement while playing.
- Keep the camera behind and above the character.
- Exit play mode with `Escape` or by clicking Run again.
- Restore editor selection, transform controls, and editor camera behavior after exit.

Excluded from this iteration:
- Physics collisions, gravity, jumping, slopes, stairs, and navmesh behavior.
- Character animation clips or blend trees.
- Multiple playable characters.
- Saving play state back into scene data beyond the character's final transform.
- Dedicated camera or light asset systems.

## Architecture

Add a focused `public/src/play-mode.js` module. It owns play state, keyboard input, mouse-look values, character movement, and follow-camera positioning. It exposes a small controller API to the editor: enter, exit, toggle, update, key handling, pointer handling, and a playing-state query.

`public/src/editor.js` remains the integration point. It finds the Run button, chooses a playable character, disables editor-only interaction while playing, forwards input to the play controller first, and lets the existing editor camera controller run only while not playing.

## Components

`play-mode.js`:
- Tracks pressed movement keys.
- Stores yaw and pitch for third-person camera orbit.
- Moves the character on the ground plane.
- Rotates the character toward its movement direction.
- Positions the camera behind the character using configurable distance, height, and shoulder offset.
- Clears input state on exit or window blur.

`editor.js` integration:
- Adds a Run button click handler.
- Adds `getPlayableCharacter()` using selected character first, then the first placed character.
- Hides transform controls and selection outline during play.
- Prevents asset placement, picking, transform manipulation, and editor camera navigation during play.
- Calls `playMode.update(deltaTime)` from the animation loop before editor camera movement.

## Data Flow

1. User drags a character into the scene.
2. User clicks Run.
3. Editor asks for a playable character.
4. Play controller enters with that character and the existing viewport camera.
5. Keyboard and pointer events update play input state.
6. Each frame moves the character and updates the camera.
7. Exit restores editor controls and clears play input.

## Error Handling

If Run is clicked with no character in the scene, play mode does not start. The Run button remains visually inactive and the editor continues normally. This iteration intentionally omits toast or inline hint UI.

If the playable character is deleted after play exits, normal editor deletion behavior remains responsible for cleanup. Deletion is not available during play mode.

## Testing

Static architecture tests should assert:
- `public/src/play-mode.js` exists and exports `createPlayModeController`.
- `editor.js` imports and creates the play mode controller.
- The Run button is wired via `data-system-tool="run"`.
- The editor blocks editor navigation and transform controls while play mode is active.

Browser verification should cover:
- Drag a character into the scene.
- Click Run.
- Press movement keys and confirm the character transform changes.
- Move the mouse and confirm the camera position changes.
- Press `Escape` and confirm editor controls return.
