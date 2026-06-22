# Camera FOV And Runtime Aspect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared FOV controls and independent runtime aspect controls, with matching play-mode framing and captured camera previews.

**Architecture:** Keep the existing single `THREE.PerspectiveCamera`. Add a small `cameraSettings` state in `public/src/editor.js`; FOV always comes from that state, edit-mode aspect comes from the editor canvas, and play-mode aspect comes from runtime settings. Use the left panel for compact camera controls and keep right-panel captured previews frozen to the aspect they had at capture time.

**Tech Stack:** Browser-native ES modules, Three.js, native form controls, existing static Node tests, in-app browser verification.

---

## File Structure

- Modify `public/index.html`: add left-panel camera controls, make the play frame use a runtime aspect CSS variable, and make preview cards accept a per-card aspect.
- Modify `public/src/editor.js`: add `cameraSettings`, control wiring, projection syncing, runtime aspect frame syncing, and captured preview aspect storage.
- Modify `tests/editor-architecture.test.mjs`: add static tests for the new controls, shared FOV state, mode-specific aspect behavior, and captured preview aspect behavior.
- Test with `tests/editor-architecture.test.mjs`, `tests/play-mode-controls.test.mjs`, `node --check`, `git diff --check`, and browser verification.

## Current Constraints

- Do not create separate edit and runtime cameras.
- Do not make the editor viewport canvas match the runtime aspect ratio.
- Do not mutate existing captured preview cards after later aspect changes.
- Keep changes scoped to camera settings, play-frame aspect, and captured previews.

### Task 1: Add Failing Static Tests

**Files:**
- Modify: `tests/editor-architecture.test.mjs`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add index control assertions**

In `tests/editor-architecture.test.mjs`, after the existing left/right panel assertions near the `const index = read("public/index.html");` section, add:

```js
assert.match(index, /id="camera-settings-panel"/);
assert.match(index, /id="camera-fov-range"/);
assert.match(index, /id="camera-fov-value"/);
assert.match(index, /data-aspect-preset="16:9"/);
assert.match(index, /data-aspect-preset="4:3"/);
assert.match(index, /data-aspect-preset="1:1"/);
assert.match(index, /data-aspect-preset="9:16"/);
assert.match(index, /id="runtime-aspect-width"/);
assert.match(index, /id="runtime-aspect-height"/);
assert.match(index, /--runtime-aspect-ratio:\s*calc\(16\s*\/\s*9\)/);
assert.match(index, /aspect-ratio:\s*var\(--runtime-aspect-ratio\)/);
assert.match(index, /--preview-aspect-ratio/);
assert.doesNotMatch(index, /\.camera-preview-card\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
```

- [ ] **Step 2: Replace the old play-frame 16:9 assertion**

Find this assertion:

```js
assert.match(index, /aspect-ratio:\s*16\s*\/\s*9/);
```

Replace it with:

```js
assert.match(index, /aspect-ratio:\s*var\(--runtime-aspect-ratio\)/);
```

- [ ] **Step 3: Add editor projection assertions**

In the `const editor = read("public/src/editor.js");` section, after the `runButton` assertion, add:

```js
assert.match(editor, /const\s+DEFAULT_CAMERA_SETTINGS\s*=\s*\{/);
assert.match(editor, /const\s+ASPECT_PRESETS\s*=\s*\[/);
assert.match(editor, /const\s+cameraSettings\s*=\s*\{\s*\.\.\.DEFAULT_CAMERA_SETTINGS\s*\}/);
assert.match(editor, /function\s+getRuntimeAspect/);
assert.match(editor, /function\s+getActiveCameraAspect/);
assert.match(editor, /function\s+syncCameraProjection/);
assert.match(editor, /camera\.fov\s*=\s*cameraSettings\.fov/);
assert.match(editor, /camera\.aspect\s*=\s*getActiveCameraAspect\(\)/);
assert.match(editor, /isPlayModeActive\(\)\s*\?\s*getRuntimeAspect\(\)\s*:\s*getCanvasAspect\(\)/);
assert.match(editor, /function\s+updateRuntimeAspectFrame/);
assert.match(editor, /style\.setProperty\(\s*["']--runtime-aspect-ratio["']/);
assert.match(editor, /function\s+setCameraFov/);
assert.match(editor, /function\s+setRuntimeAspect/);
assert.match(editor, /fovRange\?\.addEventListener\(\s*["']input["']/);
assert.match(editor, /runtimeAspectWidthInput\?\.addEventListener\(\s*["']change["']/);
assert.match(editor, /runtimeAspectHeightInput\?\.addEventListener\(\s*["']change["']/);
```

- [ ] **Step 4: Replace old canvas-only aspect assertions**

Find these assertions:

```js
assert.match(editor, /function\s+syncCameraAspectToCanvas/);
assert.match(editor, /const\s+nextAspect\s*=\s*getCanvasAspect\(\)/);
```

Replace them with:

```js
assert.doesNotMatch(editor, /function\s+syncCameraAspectToCanvas/);
assert.match(editor, /function\s+syncCameraProjection/);
assert.match(editor, /const\s+nextAspect\s*=\s*getActiveCameraAspect\(\)/);
```

- [ ] **Step 5: Add captured preview aspect assertions**

Near the existing captured preview assertions, add:

```js
assert.match(editor, /const\s+capturedAspect\s*=\s*camera\.aspect/);
assert.match(editor, /card\.style\.setProperty\(\s*["']--preview-aspect-ratio["']/);
assert.match(editor, /aspect:\s*capturedAspect/);
assert.match(editor, /const\s+cameraAspect\s*=\s*preview\.aspect\s*\?\?\s*preview\.camera\.aspect/);
assert.match(
  editor,
  /new\s+THREE\.PerspectiveCamera\(\s*camera\.fov,\s*capturedAspect,/,
  "Captured cameras should start with the current runtime aspect"
);
```

- [ ] **Step 6: Run the architecture test and verify failure**

Run:

```powershell
node tests\editor-architecture.test.mjs
```

Expected: the command fails on the first missing camera settings or UI assertion.

### Task 2: Add Camera And Runtime Aspect Controls

**Files:**
- Modify: `public/index.html`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add runtime aspect CSS variables**

In the `:root` block, add:

```css
--runtime-aspect-ratio: calc(16 / 9);
```

- [ ] **Step 2: Add left-panel layout styles**

After the `.left-ui-panel` rule, add:

```css
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  color: rgba(255, 255, 255, 0.88);
}

.settings-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.settings-value {
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.camera-range {
  width: 100%;
  accent-color: #ffffff;
}

.aspect-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.aspect-preset-button {
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.aspect-preset-button.is-active {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.aspect-custom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.number-field {
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
}
```

- [ ] **Step 3: Make the play frame use the runtime aspect variable**

Replace the current `.play-viewport-frame` width and aspect ratio declarations:

```css
width: min(
  calc(100vw - var(--side-panel-width) - var(--side-panel-width) - 48px),
  calc((100vh - 48px) * 16 / 9)
);
aspect-ratio: 16 / 9;
```

with:

```css
width: min(
  calc(100vw - var(--side-panel-width) - var(--side-panel-width) - 48px),
  calc((100vh - 48px) * var(--runtime-aspect-ratio))
);
aspect-ratio: var(--runtime-aspect-ratio);
```

- [ ] **Step 4: Make preview cards use a per-card aspect variable**

Replace the current `.camera-preview-card` aspect ratio declaration:

```css
aspect-ratio: 16 / 9;
```

with:

```css
aspect-ratio: var(--preview-aspect-ratio, var(--runtime-aspect-ratio));
```

- [ ] **Step 5: Add controls inside the left panel**

Replace this body element:

```html
<aside id="left-ui-panel" class="left-ui-panel" aria-label="left tools"></aside>
```

with:

```html
<aside id="left-ui-panel" class="left-ui-panel" aria-label="left tools">
  <section id="camera-settings-panel" class="settings-panel" aria-label="camera settings">
    <h2 class="settings-heading">Camera</h2>

    <label class="settings-field" for="camera-fov-range">
      <span class="settings-label-row">
        <span>FOV</span>
        <output id="camera-fov-value" class="settings-value" for="camera-fov-range">60</output>
      </span>
      <input
        id="camera-fov-range"
        class="camera-range"
        type="range"
        min="20"
        max="100"
        step="1"
        value="60"
      />
    </label>

    <div class="settings-field">
      <div class="settings-label-row">
        <span>Runtime Aspect</span>
        <span id="runtime-aspect-value" class="settings-value">16:9</span>
      </div>
      <div class="aspect-preset-grid" aria-label="runtime aspect presets">
        <button class="aspect-preset-button is-active" type="button" data-aspect-preset="16:9">16:9</button>
        <button class="aspect-preset-button" type="button" data-aspect-preset="4:3">4:3</button>
        <button class="aspect-preset-button" type="button" data-aspect-preset="1:1">1:1</button>
        <button class="aspect-preset-button" type="button" data-aspect-preset="9:16">9:16</button>
      </div>
      <div class="aspect-custom-grid">
        <label class="settings-field" for="runtime-aspect-width">
          <span class="settings-label-row"><span>W</span></span>
          <input id="runtime-aspect-width" class="number-field" type="number" min="1" step="1" value="16" />
        </label>
        <label class="settings-field" for="runtime-aspect-height">
          <span class="settings-label-row"><span>H</span></span>
          <input id="runtime-aspect-height" class="number-field" type="number" min="1" step="1" value="9" />
        </label>
      </div>
    </div>
  </section>
</aside>
```

- [ ] **Step 6: Run the architecture test and verify editor assertions still fail**

Run:

```powershell
node tests\editor-architecture.test.mjs
```

Expected: the index assertions pass, then the command fails on missing editor camera settings assertions.

### Task 3: Add Shared Camera Settings And Projection Syncing

**Files:**
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add settings constants**

At the top of `public/src/editor.js`, after `TRANSFORM_MODE_KEYS`, add:

```js
const DEFAULT_CAMERA_SETTINGS = {
  fov: 60,
  runtimeAspectPreset: "16:9",
  runtimeAspectWidth: 16,
  runtimeAspectHeight: 9
};

const ASPECT_PRESETS = [
  { label: "16:9", width: 16, height: 9 },
  { label: "4:3", width: 4, height: 3 },
  { label: "1:1", width: 1, height: 1 },
  { label: "9:16", width: 9, height: 16 }
];

const minCameraFov = 20;
const maxCameraFov = 100;
```

- [ ] **Step 2: Create `cameraSettings` before creating the camera**

Inside `createEditor()`, after `const initialViewport = getViewportBounds();`, add:

```js
const cameraSettings = { ...DEFAULT_CAMERA_SETTINGS };
```

- [ ] **Step 3: Use shared FOV for camera construction**

Replace this camera constructor argument:

```js
60,
```

with:

```js
cameraSettings.fov,
```

- [ ] **Step 4: Query camera settings controls**

Near the existing toolbar DOM queries, after `const runButton = document.querySelector('[data-system-tool="run"]');`, add:

```js
const playViewportFrame = document.querySelector("#play-viewport-frame");
const fovRange = document.querySelector("#camera-fov-range");
const fovValue = document.querySelector("#camera-fov-value");
const runtimeAspectValue = document.querySelector("#runtime-aspect-value");
const runtimeAspectWidthInput = document.querySelector("#runtime-aspect-width");
const runtimeAspectHeightInput = document.querySelector("#runtime-aspect-height");
const aspectPresetButtons = Array.from(document.querySelectorAll("[data-aspect-preset]"));
```

If `playViewportFrame` is already queried elsewhere, keep only one `const playViewportFrame` declaration.

- [ ] **Step 5: Add number helpers**

Before `copyCameraState`, add:

```js
function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function getRuntimeAspect() {
  return cameraSettings.runtimeAspectWidth / cameraSettings.runtimeAspectHeight;
}

function getActiveCameraAspect() {
  return isPlayModeActive() ? getRuntimeAspect() : getCanvasAspect();
}
```

- [ ] **Step 6: Replace canvas-only projection syncing**

Replace the existing `syncCameraAspectToCanvas()` function:

```js
function syncCameraAspectToCanvas() {
  const nextAspect = getCanvasAspect();

  if (Math.abs(camera.aspect - nextAspect) < 0.0001) {
    return;
  }

  camera.aspect = nextAspect;
  camera.updateProjectionMatrix();
}
```

with:

```js
function syncCameraProjection() {
  const nextAspect = getActiveCameraAspect();
  const nextFov = cameraSettings.fov;

  if (
    Math.abs(camera.aspect - nextAspect) < 0.0001 &&
    Math.abs(camera.fov - nextFov) < 0.0001
  ) {
    return false;
  }

  camera.fov = nextFov;
  camera.aspect = nextAspect;
  camera.updateProjectionMatrix();
  return true;
}
```

- [ ] **Step 7: Update render to use projection syncing**

Replace this line in `render()`:

```js
syncCameraAspectToCanvas();
```

with:

```js
syncCameraProjection();
```

- [ ] **Step 8: Update resize to use projection syncing**

In `resize()`, replace:

```js
camera.aspect = viewport.width / viewport.height;
camera.updateProjectionMatrix();
renderer.setSize(viewport.width, viewport.height);
```

with:

```js
renderer.setSize(viewport.width, viewport.height);
syncCameraProjection();
```

- [ ] **Step 9: Update capture to use projection syncing**

In `capturePlayerCamera()`, replace:

```js
syncCameraAspectToCanvas();
```

with:

```js
syncCameraProjection();
```

- [ ] **Step 10: Run syntax and architecture checks**

Run:

```powershell
node --check public\src\editor.js
node tests\editor-architecture.test.mjs
```

Expected: syntax passes. The architecture test still fails on missing UI event functions or preview aspect assertions.

### Task 4: Wire FOV And Runtime Aspect Controls

**Files:**
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Add camera settings UI update functions**

Before `copyCameraState`, after the helpers from Task 3, add:

```js
function updateFovControls() {
  const fovText = `${Math.round(cameraSettings.fov)}`;

  if (fovRange) {
    fovRange.value = fovText;
  }

  if (fovValue) {
    fovValue.value = fovText;
    fovValue.textContent = fovText;
  }
}

function getAspectLabel() {
  return `${cameraSettings.runtimeAspectWidth}:${cameraSettings.runtimeAspectHeight}`;
}

function updateAspectControls() {
  const label = getAspectLabel();

  if (runtimeAspectValue) {
    runtimeAspectValue.textContent = label;
  }

  if (runtimeAspectWidthInput) {
    runtimeAspectWidthInput.value = `${cameraSettings.runtimeAspectWidth}`;
  }

  if (runtimeAspectHeightInput) {
    runtimeAspectHeightInput.value = `${cameraSettings.runtimeAspectHeight}`;
  }

  aspectPresetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.aspectPreset === cameraSettings.runtimeAspectPreset);
  });
}

function updateRuntimeAspectFrame() {
  const aspect = getRuntimeAspect();

  document.documentElement.style.setProperty("--runtime-aspect-ratio", `${aspect}`);

  if (playViewportFrame) {
    playViewportFrame.style.setProperty("--runtime-aspect-ratio", `${aspect}`);
  }
}

function refreshCameraSettingsUi() {
  updateFovControls();
  updateAspectControls();
  updateRuntimeAspectFrame();
}
```

- [ ] **Step 2: Add FOV setter**

After `refreshCameraSettingsUi`, add:

```js
function setCameraFov(value) {
  const nextFov = clampNumber(Number(value), minCameraFov, maxCameraFov);

  if (Math.abs(cameraSettings.fov - nextFov) < 0.0001) {
    updateFovControls();
    return;
  }

  cameraSettings.fov = nextFov;
  updateFovControls();
  syncCameraProjection();
  render();
}
```

- [ ] **Step 3: Add runtime aspect setter**

After `setCameraFov`, add:

```js
function setRuntimeAspect(width, height, preset = "custom") {
  const nextWidth = Math.round(Number(width));
  const nextHeight = Math.round(Number(height));

  if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth < 1 || nextHeight < 1) {
    updateAspectControls();
    return;
  }

  if (
    cameraSettings.runtimeAspectWidth === nextWidth &&
    cameraSettings.runtimeAspectHeight === nextHeight &&
    cameraSettings.runtimeAspectPreset === preset
  ) {
    updateAspectControls();
    return;
  }

  cameraSettings.runtimeAspectWidth = nextWidth;
  cameraSettings.runtimeAspectHeight = nextHeight;
  cameraSettings.runtimeAspectPreset = preset;
  updateAspectControls();
  updateRuntimeAspectFrame();
  syncCameraProjection();
  render();
}
```

- [ ] **Step 4: Initialize camera settings UI before first render**

Near the bottom of `createEditor()`, before `renderer.setAnimationLoop(tick);`, add:

```js
refreshCameraSettingsUi();
```

- [ ] **Step 5: Add FOV input listener**

Near the other event listeners, before `runButton?.addEventListener("click", togglePlayMode);`, add:

```js
fovRange?.addEventListener("input", () => {
  setCameraFov(fovRange.value);
});
```

- [ ] **Step 6: Add aspect preset listener**

After the FOV listener, add:

```js
aspectPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = ASPECT_PRESETS.find((item) => item.label === button.dataset.aspectPreset);

    if (!preset) {
      return;
    }

    setRuntimeAspect(preset.width, preset.height, preset.label);
  });
});
```

- [ ] **Step 7: Add custom aspect listeners**

After the preset listener, add:

```js
runtimeAspectWidthInput?.addEventListener("change", () => {
  setRuntimeAspect(runtimeAspectWidthInput.value, cameraSettings.runtimeAspectHeight);
});

runtimeAspectHeightInput?.addEventListener("change", () => {
  setRuntimeAspect(cameraSettings.runtimeAspectWidth, runtimeAspectHeightInput.value);
});
```

- [ ] **Step 8: Run syntax and architecture checks**

Run:

```powershell
node --check public\src\editor.js
node tests\editor-architecture.test.mjs
```

Expected: syntax passes. The architecture test still fails on captured preview aspect assertions if Task 5 is not implemented yet.

### Task 5: Fix Captured Preview Aspect Behavior

**Files:**
- Modify: `public/src/editor.js`
- Test: `tests/editor-architecture.test.mjs`

- [ ] **Step 1: Use stored preview aspect for preview bounds**

In `getPreviewRenderBounds(preview)`, replace:

```js
const cameraAspect = preview.camera.aspect;
```

with:

```js
const cameraAspect = preview.aspect ?? preview.camera.aspect;
```

- [ ] **Step 2: Capture aspect before creating the captured camera**

In `capturePlayerCamera()`, after `syncCameraProjection();`, add:

```js
const capturedAspect = camera.aspect;
```

- [ ] **Step 3: Use captured aspect in captured camera construction**

Replace:

```js
const capturedCamera = new THREE.PerspectiveCamera(
  camera.fov,
  camera.aspect,
  camera.near,
  camera.far
);
```

with:

```js
const capturedCamera = new THREE.PerspectiveCamera(
  camera.fov,
  capturedAspect,
  camera.near,
  camera.far
);
```

- [ ] **Step 4: Set per-card preview aspect**

After:

```js
card.className = "camera-preview-card";
```

add:

```js
card.style.setProperty("--preview-aspect-ratio", `${capturedAspect}`);
```

- [ ] **Step 5: Store captured aspect in the preview model**

Replace this object:

```js
capturedCameraPreviews.push({
  camera: capturedCamera,
  canvas: previewCanvas,
  width: 1,
  height: 1,
  renderer: previewRenderer
});
```

with:

```js
capturedCameraPreviews.push({
  aspect: capturedAspect,
  camera: capturedCamera,
  canvas: previewCanvas,
  width: 1,
  height: 1,
  renderer: previewRenderer
});
```

- [ ] **Step 6: Run all static checks**

Run:

```powershell
node --check public\src\editor.js
node --check public\src\play-mode.js
node tests\editor-architecture.test.mjs
node tests\play-mode-controls.test.mjs
```

Expected: all commands exit with code `0`.

- [ ] **Step 7: Commit camera settings implementation**

Run:

```powershell
git add public\index.html public\src\editor.js tests\editor-architecture.test.mjs
git commit -m "feat: add camera fov and runtime aspect controls"
```

Expected: commit succeeds and includes only the three listed files.

### Task 6: Browser Verification

**Files:**
- No code changes unless this verification reveals a bug in files changed above.
- Verify: `http://127.0.0.1:5173/`

- [ ] **Step 1: Run final local checks**

Run:

```powershell
node --check public\src\editor.js
node --check public\src\play-mode.js
node tests\editor-architecture.test.mjs
node tests\play-mode-controls.test.mjs
python -m py_compile server.py
git diff --check
```

Expected: all commands exit with code `0`.

- [ ] **Step 2: Open or reload the local app**

Use the existing in-app browser tab at:

```text
http://127.0.0.1:5173/
```

Reload the tab after code changes.

Expected: the left panel shows Camera controls, the app loads with no browser console errors, and the editor canvas remains between the side panels.

- [ ] **Step 3: Verify FOV affects edit mode**

In the browser:

```text
Drag a Cube into the scene.
Change FOV from 60 to 35.
Confirm the editing perspective narrows.
Change FOV from 35 to 85.
Confirm the editing perspective widens.
```

Expected: the editor canvas dimensions do not change while FOV changes.

- [ ] **Step 4: Verify runtime aspect does not change edit canvas**

In the browser:

```text
Record the editor canvas bounding box.
Click the 9:16 runtime aspect preset.
Record the editor canvas bounding box again.
```

Expected: the editor canvas width and height stay the same while not playing.

- [ ] **Step 5: Verify runtime frame uses selected aspect**

In the browser:

```text
Drag a Character into the scene.
Set runtime aspect to 9:16.
Click Run.
Inspect the play viewport frame bounding box.
```

Expected: the frame height is greater than its width, matching 9:16, and the camera still uses the selected FOV.

- [ ] **Step 6: Verify captured previews use captured aspect**

In the browser:

```text
While still in play mode with 9:16 aspect, press C.
Confirm the right panel gets a tall preview card.
Change runtime aspect to 16:9.
Press C again.
Confirm the new preview card is wide.
Confirm the older 9:16 preview card remains tall.
```

Expected: preview cards preserve their captured aspect and do not stretch the scene.

- [ ] **Step 7: Check browser console logs**

Read browser console logs.

Expected: no new `error` level logs appear during FOV changes, aspect changes, play entry, camera capture, or play exit.

- [ ] **Step 8: Final diff review**

Run:

```powershell
git diff --stat HEAD~1..HEAD
git show --stat --oneline HEAD
```

Expected: the implementation commit contains only `public/index.html`, `public/src/editor.js`, and `tests/editor-architecture.test.mjs`.

## Self-Review

- Spec coverage: Tasks 2 and 4 add independent controls for FOV and runtime aspect. Task 3 keeps edit-mode aspect tied to the editor canvas and play-mode aspect tied to runtime settings. Task 5 fixes captured preview aspect behavior. Task 6 verifies the requested behaviors in the browser.
- Placeholder scan: This plan uses concrete file paths, code snippets, commands, and expected results. It avoids unresolved markers and open-ended test instructions.
- Type consistency: The plan consistently uses `cameraSettings`, `runtimeAspectWidth`, `runtimeAspectHeight`, `runtimeAspectPreset`, `getRuntimeAspect`, `getActiveCameraAspect`, `syncCameraProjection`, `setCameraFov`, and `setRuntimeAspect`.
