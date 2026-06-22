# Third-Person Play Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Run-button play mode that lets a placed character move with `WASD` while the existing viewport camera behaves like a simple third-person game camera.

**Architecture:** Add a focused `public/src/play-mode.js` controller for play input, character movement, and camera follow. Keep `public/src/editor.js` as the integration layer that chooses the playable character, toggles play mode, blocks editor interactions while playing, and restores editor controls on exit.

**Tech Stack:** Browser-native ES modules, Three.js, Shoelace toolbar controls, existing Node architecture smoke test, in-app browser verification.

---

## File Structure

- Create `public/src/play-mode.js`: third-person play controller with a small API for enter, exit, input, update, and state queries.
- Modify `public/src/editor.js`: wire the Run button, choose the character, disable editor interactions during play, and call play update each frame.
- Modify `public/index.html`: widen active-button styling from transform buttons to any active toolbar button.
- Modify `tests/editor-architecture.test.mjs`: static checks for the new controller module, Run button wiring, and editor integration.

## Scope Notes

- This plan implements movement and camera follow only.
- It does not add physics, jumping, gravity, collisions, animation clips, multi-character switching, camera assets, or light assets.
- If Run is clicked without a placed character, play mode stays off and no toast is shown.

### Task 1: Add Failing Architecture Checks For Play Mode Module

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add `play-mode.js` to the required module list**

In `tests/editor-architecture.test.mjs`, update the module-path array near the top so it contains `public/src/play-mode.js`:

```js
for (const modulePath of [
  "public/src/assets.js",
  "public/src/camera-controls.js",
  "public/src/editor.js",
  "public/src/play-mode.js",
  "public/src/selection-outline.js",
  "public/src/shortcut-panel.js",
  "public/src/shortcuts.js"
]) {
  assertFile(modulePath);
}
```

- [ ] **Step 2: Add static export checks for the new controller**

After the existing `const shortcutPanel = read("public/src/shortcut-panel.js");` assertion block, add:

```js
const playMode = read("public/src/play-mode.js");
assert.match(playMode, /export\s+function\s+createPlayModeController/);
assert.match(playMode, /function\s+enter/);
assert.match(playMode, /function\s+exit/);
assert.match(playMode, /function\s+update/);
assert.match(playMode, /function\s+handleKeyDown/);
assert.match(playMode, /function\s+handlePointerMove/);
assert.match(playMode, /isPlaying:\s*\(\)\s*=>\s*playing/);
```

- [ ] **Step 3: Run the architecture test and verify it fails for the missing module**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: the command fails with an assertion like `Expected public/src/play-mode.js to exist`.

### Task 2: Create The Play Mode Controller

**Files:**
- Create: `public/src/play-mode.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Create `public/src/play-mode.js`**

Add this complete file:

```js
import * as THREE from "three";

const defaultOptions = {
  cameraDistance: 6,
  cameraHeight: 1.8,
  cameraTargetHeight: 1.2,
  lookSensitivity: 0.003,
  maxPitch: 0.55,
  minPitch: -0.35,
  moveSpeed: 4.5,
  shoulderOffset: 0.45
};

const movementKeys = new Set(["keyw", "keya", "keys", "keyd"]);

export function createPlayModeController({
  camera,
  renderer,
  render,
  onChange = () => {},
  options = {}
}) {
  const config = { ...defaultOptions, ...options };
  const keys = new Set();
  const forward = new THREE.Vector3();
  const moveDirection = new THREE.Vector3();
  const right = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const focusPoint = new THREE.Vector3();

  let player = null;
  let playing = false;
  let previousCursor = "";
  let yaw = 0;
  let pitch = 0.18;

  function syncYawFromCamera() {
    camera.getWorldDirection(forward);

    if (forward.lengthSq() === 0) {
      yaw = 0;
      return;
    }

    yaw = Math.atan2(forward.y, forward.x);
  }

  function setCursorForPlayMode() {
    previousCursor = renderer.domElement.style.cursor;
    renderer.domElement.style.cursor = "crosshair";
  }

  function restoreCursor() {
    renderer.domElement.style.cursor = previousCursor;
  }

  function getGroundForward() {
    return forward.set(Math.cos(yaw), Math.sin(yaw), 0).normalize();
  }

  function getGroundRight() {
    return right.set(-Math.sin(yaw), Math.cos(yaw), 0).normalize();
  }

  function updateCamera() {
    if (!player) {
      return;
    }

    const groundForward = getGroundForward();
    const groundRight = getGroundRight();
    const horizontalDistance = config.cameraDistance * Math.cos(pitch);
    const verticalOffset = config.cameraHeight + config.cameraDistance * Math.sin(pitch);

    focusPoint.copy(player.position);
    focusPoint.z += config.cameraTargetHeight;

    cameraPosition
      .copy(focusPoint)
      .addScaledVector(groundForward, -horizontalDistance)
      .addScaledVector(groundRight, config.shoulderOffset);
    cameraPosition.z += verticalOffset;

    camera.position.copy(cameraPosition);
    camera.lookAt(focusPoint);
  }

  function enter(character) {
    if (!character || character.userData.assetType !== "character") {
      return false;
    }

    player = character;
    playing = true;
    keys.clear();
    syncYawFromCamera();
    pitch = 0.18;
    setCursorForPlayMode();
    renderer.domElement.focus();
    updateCamera();
    render();
    onChange(true);
    return true;
  }

  function exit() {
    if (!playing) {
      return false;
    }

    playing = false;
    player = null;
    keys.clear();
    restoreCursor();
    render();
    onChange(false);
    return true;
  }

  function handleKeyDown(event) {
    if (!playing) {
      return false;
    }

    const code = event.code.toLowerCase();
    event.preventDefault();

    if (code === "escape") {
      exit();
      return true;
    }

    if (movementKeys.has(code)) {
      keys.add(code);
    }

    return true;
  }

  function handleKeyUp(event) {
    if (!playing) {
      return false;
    }

    const code = event.code.toLowerCase();
    event.preventDefault();

    if (movementKeys.has(code)) {
      keys.delete(code);
    }

    return true;
  }

  function handlePointerMove(event) {
    if (!playing) {
      return false;
    }

    const dx = event.movementX || 0;
    const dy = event.movementY || 0;
    event.preventDefault();

    if (dx === 0 && dy === 0) {
      return true;
    }

    yaw -= dx * config.lookSensitivity;
    pitch = THREE.MathUtils.clamp(
      pitch - dy * config.lookSensitivity,
      config.minPitch,
      config.maxPitch
    );
    updateCamera();
    render();
    return true;
  }

  function update(deltaTime) {
    if (!playing || !player) {
      return false;
    }

    moveDirection.set(0, 0, 0);

    if (keys.has("keyw")) {
      moveDirection.add(getGroundForward());
    }

    if (keys.has("keys")) {
      moveDirection.addScaledVector(getGroundForward(), -1);
    }

    if (keys.has("keyd")) {
      moveDirection.add(getGroundRight());
    }

    if (keys.has("keya")) {
      moveDirection.addScaledVector(getGroundRight(), -1);
    }

    if (moveDirection.lengthSq() === 0) {
      return false;
    }

    moveDirection.normalize();
    player.position.addScaledVector(moveDirection, config.moveSpeed * deltaTime);
    player.rotation.z = Math.atan2(moveDirection.y, moveDirection.x) - Math.PI / 2;
    updateCamera();
    return true;
  }

  function clearInput() {
    keys.clear();
  }

  return {
    clearInput,
    enter,
    exit,
    handleKeyDown,
    handleKeyUp,
    handlePointerMove,
    isPlaying: () => playing,
    update
  };
}
```

- [ ] **Step 2: Run syntax check for the new module**

Run:

```powershell
node --check public/src/play-mode.js
```

Expected: exit code `0` and no syntax errors.

- [ ] **Step 3: Run architecture test and verify the new module assertions pass**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: exit code `0` for the play-mode module checks added in Task 1.

- [ ] **Step 4: Commit the controller module**

Run:

```powershell
git add tests/editor-architecture.test.mjs public/src/play-mode.js
git commit -m "feat: add third-person play mode controller"
```

Expected: commit succeeds and includes only `tests/editor-architecture.test.mjs` plus `public/src/play-mode.js`.

### Task 3: Add Failing Architecture Checks For Editor Integration

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add Run button assertions to the index checks**

In the existing `const index = read("public/index.html");` section, add:

```js
assert.match(index, /<sl-icon-button[^>]+name="play-fill"[^>]+data-system-tool="run"/);
assert.match(index, /\.tool-button\.is-active::part\(base\)/);
```

- [ ] **Step 2: Add editor integration assertions**

In the existing `const editor = read("public/src/editor.js");` section, add:

```js
assert.match(editor, /import\s+\{\s*createPlayModeController\s*\}\s+from\s+["']\.\/play-mode\.js["']/);
assert.match(editor, /const\s+runButton\s*=\s*document\.querySelector\(\s*["']\[data-system-tool="run"\]["']\s*\)/);
assert.match(editor, /function\s+isPlayModeActive/);
assert.match(editor, /function\s+getPlayableCharacter/);
assert.match(editor, /selectedAsset\?\.userData\.assetType\s*===\s*["']character["']/);
assert.match(editor, /createPlayModeController\(\{/);
assert.match(editor, /function\s+togglePlayMode/);
assert.match(editor, /playMode\.handleKeyDown\(event\)/);
assert.match(editor, /playMode\.handleKeyUp\(event\)/);
assert.match(editor, /playMode\.handlePointerMove\(event\)/);
assert.match(editor, /playMode\.update\(deltaTime\)/);
assert.match(editor, /runButton\?\.addEventListener\(\s*["']click["'],\s*togglePlayMode\s*\)/);
```

- [ ] **Step 3: Run architecture test and verify it fails for missing integration**

Run:

```powershell
node tests/editor-architecture.test.mjs
```

Expected: the command fails on the first missing editor integration assertion, such as missing `createPlayModeController` import.

### Task 4: Wire Play Mode Into The Editor

**Files:**
- Modify: `public/src/editor.js`
- Modify: `public/index.html`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Import the play-mode controller**

At the top of `public/src/editor.js`, add this import with the other local imports:

```js
import { createPlayModeController } from "./play-mode.js";
```

- [ ] **Step 2: Read the Run button from the toolbar**

Near the existing toolbar queries in `createEditor()`, use this block:

```js
const assetToolbar = document.querySelector("#asset-toolbar");
const transformToolbar = document.querySelector("#transform-toolbar");
const transformButtons = Array.from(document.querySelectorAll("[data-transform-mode]"));
const runButton = document.querySelector('[data-system-tool="run"]');
const dragPreview = document.querySelector("#drag-preview");
```

- [ ] **Step 3: Add play-mode state**

Near the existing mutable state declarations, use this block:

```js
let dragState = null;
let cameraControls = null;
let playMode = null;
let nextAssetId = 1;
let selectedAsset = null;
let duplicateOnTransformDrag = false;
let duplicatedTransformAsset = null;
let isTransformDragging = false;
let transformStart = null;
let lastFrameTime = 0;
let activeTransformMode = "translate";
let transformGizmoVisible = true;
let selectionOutlineVisible = true;
const undoStack = [];
```

- [ ] **Step 4: Block editor navigation while play mode is active**

In the `createCameraController` call, update `isNavigationBlocked` to:

```js
isNavigationBlocked: () => isPlayModeActive() || dragState || isTransformDragging || transformControls.dragging,
```

- [ ] **Step 5: Create the play-mode controller after camera controls**

Immediately after the `cameraControls = createCameraController({ ... });` block, add:

```js
playMode = createPlayModeController({
  camera,
  renderer,
  render,
  onChange: updatePlayModeFeedback
});
```

- [ ] **Step 6: Add play-mode helper functions**

Add these functions near the other editor state helpers, before `markAsset`:

```js
function isPlayModeActive() {
  return playMode?.isPlaying() ?? false;
}

function getPlayableCharacter() {
  if (selectedAsset?.userData.assetType === "character") {
    return selectedAsset;
  }

  return placedAssets.find((asset) => asset.userData.assetType === "character") ?? null;
}

function updatePlayModeFeedback() {
  const playing = isPlayModeActive();

  runButton?.classList.toggle("is-active", playing);
  transformToolbar.hidden = playing || !selectedAsset;
  updateSelectionFeedback();

  if (playing) {
    renderer.domElement.focus();
  }
}

function togglePlayMode() {
  if (isPlayModeActive()) {
    playMode.exit();
    return;
  }

  if (!playMode.enter(getPlayableCharacter())) {
    updatePlayModeFeedback();
  }
}
```

- [ ] **Step 7: Hide transform and selection feedback during play**

Replace `updateSelectionFeedback()` with:

```js
function updateSelectionFeedback() {
  const hasSelection = Boolean(selectedAsset);
  const playing = isPlayModeActive();
  const showTransform = hasSelection && transformGizmoVisible && !playing;

  transformControls.visible = showTransform;
  transformControls.enabled = showTransform && !cameraControls.isDragging();
  rebuildSelectionOutlineMask();
}
```

Replace `rebuildSelectionOutlineMask()` with:

```js
function rebuildSelectionOutlineMask() {
  selectionOutline.rebuild(selectedAsset, selectionOutlineVisible && !isPlayModeActive());
}
```

Replace the first line inside `selectAsset(asset)` that controls toolbar visibility with:

```js
transformToolbar.hidden = !selectedAsset || isPlayModeActive();
```

- [ ] **Step 8: Prevent edit actions while playing**

At the start of `deleteSelectedAsset()`, make the guard:

```js
if (!selectedAsset || isPlayModeActive() || isTransformDragging || cameraControls.isDragging()) {
  return false;
}
```

At the start of `pickAsset(event, asset = getAssetAtEvent(event))`, make the guard:

```js
if (
  isPlayModeActive() ||
  event.button !== 0 ||
  dragState ||
  cameraControls.isDragging() ||
  isTransformDragging ||
  transformControls.dragging
) {
  return;
}
```

At the start of `beginAssetDrag(event)`, add:

```js
if (isPlayModeActive()) {
  return;
}
```

In `prepareTransformDuplicate(event)`, add `isPlayModeActive()` to the existing early-return condition:

```js
if (
  isPlayModeActive() ||
  event.button !== 0 ||
  !event.altKey ||
  !selectedAsset ||
  !transformGizmoVisible ||
  !transformControls.visible ||
  !transformControls.enabled ||
  cameraControls.isDragging() ||
  dragState
) {
  return;
}
```

- [ ] **Step 9: Forward keyboard events to play mode first**

At the top of `pressKey(event)`, before reading `event.code`, add:

```js
if (playMode.handleKeyDown(event)) {
  return;
}
```

Replace the existing keyup listener with:

```js
window.addEventListener("keyup", (event) => {
  if (playMode.handleKeyUp(event)) {
    return;
  }

  cameraControls.releaseKey(event);
});
```

Update the blur listener to:

```js
window.addEventListener("blur", () => {
  playMode.clearInput();
  cameraControls.clearState();
});
```

- [ ] **Step 10: Forward pointer movement to play mode first**

Replace the existing window pointermove listener with:

```js
window.addEventListener("pointermove", (event) => {
  if (playMode.handlePointerMove(event)) {
    return;
  }

  moveAssetDrag(event);
});
```

Replace the renderer pointermove listeners with:

```js
renderer.domElement.addEventListener("pointermove", (event) => {
  if (isPlayModeActive()) {
    return;
  }

  updateGridCursor(event);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (isPlayModeActive()) {
    return;
  }

  cameraControls.handlePointerMove(event);
});
```

Replace the renderer pointerdown listener for camera controls with:

```js
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (isPlayModeActive()) {
    renderer.domElement.focus();
    event.preventDefault();
    return;
  }

  cameraControls.handlePointerDown(event);
});
```

Replace the renderer pointerup and pointercancel listeners with:

```js
renderer.domElement.addEventListener("pointerup", (event) => {
  if (!isPlayModeActive()) {
    cameraControls.handlePointerUp(event);
  }
});
renderer.domElement.addEventListener("pointercancel", (event) => {
  if (!isPlayModeActive()) {
    cameraControls.handlePointerUp(event);
  }
});
```

Replace the wheel listener with:

```js
renderer.domElement.addEventListener("wheel", (event) => {
  if (isPlayModeActive()) {
    event.preventDefault();
    return;
  }

  cameraControls.zoomView(event);
}, { passive: false });
```

- [ ] **Step 11: Update the frame loop**

Replace `tick(time)` with:

```js
function tick(time) {
  const deltaTime = Math.min((time - lastFrameTime) / 1000 || 0, 0.05);
  lastFrameTime = time;

  let needsRender = playMode.update(deltaTime);

  if (!isPlayModeActive() && cameraControls.updateMovement(deltaTime)) {
    needsRender = true;
  }

  if (needsRender) {
    render();
  }
}
```

- [ ] **Step 12: Wire the Run button click**

Near the existing toolbar event listeners, add:

```js
runButton?.addEventListener("click", togglePlayMode);
```

- [ ] **Step 13: Broaden active toolbar button styling**

In `public/index.html`, replace this selector:

```css
.transform-button.is-active::part(base) {
```

with:

```css
.tool-button.is-active::part(base) {
```

- [ ] **Step 14: Run syntax and architecture checks**

Run:

```powershell
node --check public/src/editor.js
node --check public/src/play-mode.js
node tests/editor-architecture.test.mjs
```

Expected: all three commands exit with code `0`.

- [ ] **Step 15: Commit editor integration**

Run:

```powershell
git add public/src/editor.js public/index.html tests/editor-architecture.test.mjs
git commit -m "feat: wire third-person play mode"
```

Expected: commit succeeds and includes only the editor integration, active button styling, and related test assertions.

### Task 5: Browser Verification

**Files:**
- No code changes unless verification reveals a bug in the files changed by Tasks 2 or 4.
- Verify: `http://127.0.0.1:8000/` or the local URL printed by `python server.py`

- [ ] **Step 1: Confirm static checks still pass**

Run:

```powershell
node --check public/src/editor.js
node --check public/src/play-mode.js
node tests/editor-architecture.test.mjs
git diff --check
```

Expected: Node commands exit with code `0`. `git diff --check` exits with code `0`; existing CRLF normalization warnings are acceptable if there are no whitespace-error lines.

- [ ] **Step 2: Start or reuse the local server**

If the current page at `http://127.0.0.1:8000/` is still live, reuse it. If it is not live, run:

```powershell
python server.py
```

Expected: the server prints a local URL such as `http://localhost:5173`.

- [ ] **Step 3: Verify no-character Run behavior**

In the browser:

```text
Open the local app.
Do not place a character.
Click the Run button.
Confirm the Run button does not stay visually active.
Confirm editor camera controls and asset dragging still work.
```

- [ ] **Step 4: Verify character play behavior**

In the browser:

```text
Drag the Character toolbar icon into the scene.
Click the Run button.
Confirm the Run button becomes active.
Press W for about one second.
Confirm the character moves on the ground plane and the camera follows from behind.
Move the mouse horizontally.
Confirm the camera orbits around the character.
Press A or D.
Confirm the movement direction follows the camera yaw.
Press Escape.
Confirm the Run button becomes inactive and transform controls return for the selected character.
```

- [ ] **Step 5: Check browser console**

Use the in-app browser console log reader or DevTools logs.

Expected: no new `error` level logs are emitted while entering, moving, rotating camera, or exiting play mode.

- [ ] **Step 6: Final diff review**

Run:

```powershell
git diff --stat
git diff -- public/src/play-mode.js public/src/editor.js public/index.html tests/editor-architecture.test.mjs
```

Expected: changes are limited to the play-mode controller, editor integration, active toolbar styling, and architecture tests.

## Self-Review

- Spec coverage: Tasks 2 and 4 implement Run entry, selected-or-first character selection, `WASD` movement, mouse camera rotation, follow camera, `Escape` or Run exit, and editor restoration. Task 5 verifies the browser behavior.
- Scan result: The plan was checked for banned planning phrases and none are present.
- Type consistency: The controller export is `createPlayModeController`; editor integration uses `playMode.enter`, `playMode.exit`, `playMode.update`, `playMode.handleKeyDown`, `playMode.handleKeyUp`, `playMode.handlePointerMove`, `playMode.clearInput`, and `playMode.isPlaying`.
