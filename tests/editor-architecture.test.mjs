import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
  assert.ok(existsSync(join(root, relativePath)), `Expected ${relativePath} to exist`);
}

function assertNoFile(relativePath) {
  assert.ok(!existsSync(join(root, relativePath)), `Expected ${relativePath} to be removed`);
}

for (const modulePath of [
  "public/src/assets.js",
  "public/src/camera-controls.js",
  "public/src/editor.js",
  "public/src/play-mode.js",
  "public/src/selection-outline.js"
]) {
  assertFile(modulePath);
}

assertNoFile("public/src/shortcut-panel.js");
assertNoFile("public/src/shortcuts.js");

const app = read("public/app.js");
assert.match(app, /import\s+\{\s*createEditor\s*\}\s+from\s+["']\.\/src\/editor\.js\?v=right-panel-wide["']/);
assert.doesNotMatch(app, /shortcut-panel/);
assert.doesNotMatch(app, /shortcutSections/);
assert.doesNotMatch(app, /mountShortcutPanel/);
assert.doesNotMatch(app, /new\s+THREE\.Scene/);
assert.doesNotMatch(app, /TransformControls/);

const index = read("public/index.html");
assert.match(index, /sl-theme-dark/);
assert.match(index, /@shoelace-style\/shoelace@2\.20\.1\/cdn\/themes\/dark\.css/);
assert.match(index, /@shoelace-style\/shoelace@2\.20\.1\/cdn\/shoelace-autoloader\.js/);
assert.match(index, /<script type="module" src="\/app\.js\?v=right-panel-wide"><\/script>/);
assert.match(index, /<sl-tooltip[^>]+content="Cube"/);
assert.match(index, /<sl-icon-button[^>]+data-asset="cube"/);
assert.match(index, /<sl-tooltip[^>]+content="Road"/);
assert.match(
  index,
  /<sl-icon-button[^>]+class="tool-button"[^>]+name="map"[^>]+data-system-tool="road"[^>]+label="Road"/,
  "The toolbar should expose a simple road drawing tool"
);
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
assert.match(index, /<sl-icon-button[^>]+data-transform-mode="translate"/);
assert.match(index, /<sl-icon-button[^>]+name="play-fill"[^>]+data-system-tool="run"/);
assert.match(index, /\.tool-button\.is-active::part\(base\)/);
assert.match(index, /id="camera-speed-control"/);
assert.match(index, /id="camera-speed-input"/);
assert.match(index, /class="camera-speed-control"/);
assert.match(index, /\.camera-speed-control\s*\{[\s\S]*left:\s*calc\(var\(--side-panel-width\)\s*\+\s*338px\)/);
assert.match(index, /<span[^>]+class="camera-speed-label"[^>]*>Speed<\/span>/);
assert.match(index, /id="play-viewport-frame"/);
assert.match(index, /\.play-viewport-frame/);
assert.match(index, /aspect-ratio:\s*var\(--runtime-aspect-ratio\)/);
assert.match(index, /right:\s*var\(--right-panel-width\)/);
assert.match(index, /left:\s*var\(--side-panel-width\)/);
assert.match(index, /box-shadow:\s*0\s+0\s+0\s+100vmax\s+rgba\(0,\s*0,\s*0,\s*0\.62\)/);
assert.match(index, /--side-panel-width:\s*320px/);
assert.match(index, /--right-panel-collapsed-width:\s*52px/);
assert.match(index, /--right-panel-default-width:\s*280px/);
assert.match(index, /--right-panel-width:\s*var\(--right-panel-default-width\)/);
assert.match(
  index,
  /--right-panel-column-width:\s*calc\(var\(--right-panel-default-width\)\s*-\s*var\(--right-panel-collapsed-width\)\)/,
  "Right panel wide mode should preserve the default content column width"
);
assert.match(
  index,
  /--right-panel-expanded-width:\s*calc\(\s*var\(--right-panel-collapsed-width\)\s*\+\s*var\(--right-panel-column-width\)\s*\+\s*var\(--right-panel-column-width\)\s*\+\s*var\(--right-panel-column-width\)\s*\+\s*var\(--right-panel-column-width\)\s*\)/,
  "Expanded right panel width should fit four default-width columns plus the rail"
);
assert.match(index, /--runtime-aspect-ratio:\s*calc\(16\s*\/\s*9\)/);
assert.match(index, /id="left-ui-panel"/);
assert.match(index, /id="right-ui-panel"/);
assert.match(index, /id="right-panel-rail"/);
assert.match(index, /id="right-panel-toggle"/);
assert.match(index, /id="right-panel-wide-toggle"/);
assert.match(index, /data-panel-tool="toggle-right-panel"/);
assert.match(index, /data-panel-tool="toggle-right-panel-width"/);
assert.match(index, /<sl-tooltip[^>]+content="统一展开"[^>]*>[\s\S]*id="right-panel-wide-toggle"/);
assert.match(index, /<sl-icon-button[^>]+id="right-panel-wide-toggle"[^>]+label="统一展开"/);
assert.match(index, /aria-expanded="true"/);
assert.match(index, /aria-pressed="false"/);
assert.match(index, /class="right-panel-rail"/);
assert.match(index, /\.right-panel-rail\s*\{/);
assert.match(index, /\.right-panel-toggle::part\(base\)/);
assert.match(index, /body\.is-right-panel-wide\s*\{[\s\S]*--right-panel-width:\s*var\(--right-panel-expanded-width\)/);
assert.match(index, /body\.is-right-panel-collapsed\s*\{[\s\S]*--right-panel-width:\s*var\(--right-panel-collapsed-width\)/);
assert.match(index, /body\.is-right-panel-collapsed\s+\.camera-preview-list\s*\{[\s\S]*display:\s*none/);
assert.match(index, /id="camera-preview-list"/);
assert.match(index, /id="camera-settings-panel"/);
assert.match(index, /id="camera-fov-range"/);
assert.match(index, /id="camera-fov-value"/);
assert.match(index, /data-aspect-preset="16:9"/);
assert.match(index, /data-aspect-preset="4:3"/);
assert.match(index, /data-aspect-preset="1:1"/);
assert.match(index, /data-aspect-preset="9:16"/);
assert.doesNotMatch(
  index,
  /id="runtime-aspect-width"/,
  "Runtime aspect should no longer expose a custom width input"
);
assert.doesNotMatch(
  index,
  /id="runtime-aspect-height"/,
  "Runtime aspect should no longer expose a custom height input"
);
assert.doesNotMatch(
  index,
  /class="aspect-custom-grid"/,
  "Runtime aspect should only expose presets, not a custom W/H row"
);
assert.match(index, /\.left-ui-panel,\s*[\s\S]*\.right-ui-panel\s*\{/);
assert.match(index, /\.left-ui-panel\s*\{/);
assert.match(index, /\.right-ui-panel/);
assert.match(index, /id="right-panel-content"/);
assert.match(index, /class="right-panel-content"/);
assert.match(index, /\.camera-preview-list/);
assert.match(index, /id="right-panel-secondary-column"/);
assert.match(index, /class="right-panel-secondary-column"/);
assert.match(index, /id="right-panel-tertiary-column"/);
assert.match(index, /id="right-panel-quaternary-column"/);
assert.match(
  index,
  /body\.is-right-panel-wide\s+\.right-panel-content\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(var\(--right-panel-column-width\),\s*1fr\)\)/,
  "Wide right panel should split into four columns without shrinking the default column width"
);
assert.doesNotMatch(
  index,
  /body\.is-right-panel-wide\s+\.camera-preview-list\s*\{[\s\S]*grid-template-columns/,
  "Captured camera previews should stay in their own single-column container"
);
assert.match(index, /\.camera-preview-card/);
assert.match(index, /--preview-aspect-ratio/);
assert.doesNotMatch(index, /\.camera-preview-card\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
assert.match(index, /--camera-preview-border-width:\s*3px/);
assert.match(index, /border:\s*var\(--camera-preview-border-width\)\s+solid\s+#ff4d4d/);
assert.match(
  index,
  /\.camera-preview-card canvas\s*\{[\s\S]*width:\s*calc\(100%\s*\+\s*var\(--camera-preview-border-width\)\s*\*\s*2\)/,
  "Camera preview canvas should render at the full 16:9 preview frame width, not the border-shrunk content width"
);
assert.match(
  index,
  /\.camera-preview-card canvas\s*\{[\s\S]*height:\s*calc\(100%\s*\+\s*var\(--camera-preview-border-width\)\s*\*\s*2\)/,
  "Camera preview canvas should render at the full 16:9 preview frame height, not the border-shrunk content height"
);
assert.match(index, /\.asset-toolbar,\s*[\s\S]*\.transform-toolbar\s*\{[\s\S]*left:\s*calc\(var\(--side-panel-width\)\s*\+\s*12px\)/);
assert.match(index, /flex-direction:\s*row/);
assert.match(index, /width:\s*calc\(100vw\s*-\s*var\(--side-panel-width\)\s*-\s*var\(--right-panel-width\)\)/);
assert.doesNotMatch(index, /shortcut-panel/);
assert.doesNotMatch(index, /data-shortcut-panel/);
assert.doesNotMatch(index, /Viewport Shortcuts/);
assert.doesNotMatch(index, /视口快捷键/);

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

const playMode = read("public/src/play-mode.js");
assert.match(playMode, /export\s+function\s+createPlayModeController/);
assert.match(playMode, /function\s+enter/);
assert.match(playMode, /function\s+exit/);
assert.match(playMode, /function\s+update/);
assert.match(playMode, /function\s+handleKeyDown/);
assert.match(playMode, /function\s+handlePointerMove/);
assert.match(playMode, /isPlaying:\s*\(\)\s*=>\s*playing/);

const cameraControls = read("public/src/camera-controls.js");
assert.match(cameraControls, /onMoveSpeedChange\s*=\s*\(\)\s*=>\s*\{\}/);
assert.match(cameraControls, /function\s+setMoveSpeed\(value\)/);
assert.match(cameraControls, /cameraMoveSpeed\s*=\s*THREE\.MathUtils\.clamp/);
assert.match(cameraControls, /onMoveSpeedChange\(cameraMoveSpeed\)/);
assert.match(cameraControls, /getMoveSpeed:\s*\(\)\s*=>\s*cameraMoveSpeed/);
assert.match(cameraControls, /setMoveSpeed/);

const editor = read("public/src/editor.js");
assert.match(editor, /export\s+function\s+createEditor/);
assert.match(editor, /createSelectionOutline/);
assert.match(editor, /createCameraController/);
assert.match(editor, /import\s+\{\s*createPlayModeController\s*\}\s+from\s+["']\.\/play-mode\.js["']/);
assert.match(editor, /const\s+TRANSFORM_MODE_KEYS\s*=\s*\{/);
assert.match(editor, /const\s+DEFAULT_CAMERA_SETTINGS\s*=\s*\{/);
assert.doesNotMatch(
  editor,
  /const\s+ASPECT_PRESETS\s*=\s*\[/,
  "Runtime aspect presets should be parsed from the existing button data instead of duplicated in JS"
);
assert.doesNotMatch(editor, /from\s+["']\.\/shortcuts\.js["']/);
assert.match(editor, /const\s+runButton\s*=\s*document\.querySelector\(\s*["']\[data-system-tool="run"\]["']\s*\)/);
assert.match(editor, /const\s+roadButton\s*=\s*document\.querySelector\(\s*["']\[data-system-tool="road"\]["']\s*\)/);
assert.match(editor, /const\s+rightPanelToggleButton\s*=\s*document\.querySelector\(\s*["']#right-panel-toggle["']\s*\)/);
assert.match(editor, /const\s+rightPanelWideToggleButton\s*=\s*document\.querySelector\(\s*["']#right-panel-wide-toggle["']\s*\)/);
assert.match(editor, /const\s+cameraSpeedInput\s*=\s*document\.querySelector\(\s*["']#camera-speed-input["']\s*\)/);
assert.match(editor, /const\s+cameraSettings\s*=\s*\{\s*\.\.\.DEFAULT_CAMERA_SETTINGS\s*\}/);
assert.match(editor, /function\s+getRuntimeAspect/);
assert.match(editor, /function\s+getActiveCameraAspect/);
assert.match(
  editor,
  /function\s+parseAspectPreset\(preset\)\s*\{[\s\S]*split\(["']:["']\)[\s\S]*width[\s\S]*height[\s\S]*\}/,
  "Editor should parse runtime aspect presets from button data"
);
assert.match(editor, /function\s+syncCameraProjection/);
assert.match(editor, /camera\.fov\s*=\s*cameraSettings\.fov/);
assert.match(editor, /camera\.aspect\s*=\s*nextAspect/);
assert.match(editor, /isPlayModeActive\(\)\s*\?\s*getRuntimeAspect\(\)\s*:\s*getCanvasAspect\(\)/);
assert.match(editor, /function\s+updateRuntimeAspectFrame/);
assert.match(editor, /style\.setProperty\(\s*["']--runtime-aspect-ratio["']/);
assert.match(editor, /function\s+setCameraFov/);
assert.match(editor, /function\s+setRuntimeAspect/);
assert.match(editor, /function\s+updateCameraSpeedControl/);
assert.match(editor, /function\s+setCameraMoveSpeed/);
assert.match(editor, /function\s+setRightPanelCollapsed\(collapsed\)/);
assert.match(editor, /let\s+rightPanelWide\s*=\s*false/);
assert.match(editor, /function\s+setRightPanelWide\(wide\)/);
assert.match(editor, /const\s+roadTiles\s*=\s*new\s+Map\(\)/);
assert.match(editor, /let\s+roadDrawingMode\s*=\s*false/);
assert.match(editor, /let\s+roadDrawing\s*=\s*false/);
assert.match(editor, /function\s+getRoadCellFromPoint\(point\)/);
assert.match(editor, /Math\.floor\(point\.x\s*\/\s*gridSnapSize\)/);
assert.match(editor, /Math\.floor\(point\.y\s*\/\s*gridSnapSize\)/);
assert.match(editor, /function\s+paintRoadAtPoint\(point\)/);
assert.match(editor, /new\s+THREE\.PlaneGeometry\(gridSnapSize,\s*gridSnapSize\)/);
assert.match(editor, /new\s+THREE\.MeshBasicMaterial\(\{\s*color:\s*0xff0000/);
assert.match(editor, /roadTile\.position\.set\(\s*\(cell\.x\s*\+\s*0\.5\)\s*\*\s*gridSnapSize,\s*\(cell\.y\s*\+\s*0\.5\)\s*\*\s*gridSnapSize,\s*0\.02\s*\)/);
assert.match(editor, /roadTile\.userData\.pickable\s*=\s*false/);
assert.match(editor, /let\s+roadDrawingTiles\s*=\s*\[\]/);
assert.match(
  editor,
  /function\s+recordRoadTile\(point\)[\s\S]*paintRoadAtPoint\(point\)[\s\S]*roadDrawingTiles\.push\(paintedTile\)/,
  "Road drawing should collect newly painted tiles for one undoable stroke"
);
assert.match(
  editor,
  /function\s+endRoadDrawing\(\)[\s\S]*pushUndo\(\{\s*type:\s*["']road-draw["'],\s*tiles:\s*\[\.\.\.roadDrawingTiles\]\s*\}\)/,
  "Ending a road stroke should add the painted tiles to the undo stack"
);
assert.match(
  editor,
  /if\s*\(action\.type\s*===\s*["']road-draw["']\)[\s\S]*scene\.remove\(tile\.mesh\)[\s\S]*roadTiles\.delete\(tile\.key\)/,
  "Undoing a road stroke should remove its road meshes and clear their occupied cells"
);
assert.match(editor, /function\s+setRoadDrawingMode\(active\)/);
assert.match(editor, /roadButton\?\.classList\.toggle\(\s*["']is-active["'],\s*roadDrawingMode\s*\)/);
assert.match(editor, /function\s+cancelRoadDrawingMode\(\)\s*\{[\s\S]*setRoadDrawingMode\(false\)[\s\S]*\}/);
assert.match(
  editor,
  /const\s+button\s*=\s*event\.target\.closest\(\s*["']\[data-asset\]["']\s*\)[\s\S]*if\s*\(!button\s*\|\|[\s\S]*return;[\s\S]*cancelRoadDrawingMode\(\);[\s\S]*dragState\s*=\s*\{/,
  "Starting any asset drag should cancel the road tool"
);
assert.match(
  editor,
  /transformToolbar\.addEventListener\(\s*["']click["'],[\s\S]*if\s*\(button\)\s*\{[\s\S]*cancelRoadDrawingMode\(\);[\s\S]*setTransformMode\(button\.dataset\.transformMode\)/,
  "Choosing a transform tool should cancel the road tool"
);
assert.match(
  editor,
  /runButton\?\.addEventListener\(\s*["']click["'],\s*\(\)\s*=>\s*\{[\s\S]*cancelRoadDrawingMode\(\);[\s\S]*togglePlayMode\(\);[\s\S]*\}\s*\)/,
  "Entering another toolbar mode such as Run should cancel the road tool"
);
assert.match(editor, /function\s+beginRoadDrawing\(event\)/);
assert.match(editor, /function\s+continueRoadDrawing\(event\)/);
assert.match(editor, /function\s+endRoadDrawing\(\)/);
assert.match(editor, /document\.body\.classList\.toggle\(\s*["']is-right-panel-collapsed["'],\s*rightPanelCollapsed\s*\)/);
assert.match(editor, /rightPanelToggleButton\?\.setAttribute\(\s*["']aria-expanded["'],\s*`\$\{!rightPanelCollapsed\}`\s*\)/);
assert.match(editor, /rightPanelToggleButton\.name\s*=\s*rightPanelCollapsed\s*\?\s*["']chevron-left["']\s*:\s*["']chevron-right["']/);
assert.match(editor, /document\.body\.classList\.toggle\(\s*["']is-right-panel-wide["'],\s*rightPanelWide\s*\)/);
assert.match(editor, /rightPanelWideToggleButton\?\.setAttribute\(\s*["']aria-pressed["'],\s*`\$\{rightPanelWide\}`\s*\)/);
assert.match(editor, /const\s+nextLabel\s*=\s*rightPanelWide\s*\?\s*["']统一收起["']\s*:\s*["']统一展开["']/);
assert.match(editor, /const\s+nextIcon\s*=\s*rightPanelWide\s*\?\s*["']chevron-double-right["']\s*:\s*["']chevron-double-left["']/);
assert.match(editor, /rightPanelWideToggleButton\.name\s*=\s*nextIcon/);
assert.match(editor, /rightPanelWideToggleButton\.label\s*=\s*nextLabel/);
assert.match(editor, /rightPanelWideToggleButton\.setAttribute\(\s*["']name["'],\s*nextIcon\s*\)/);
assert.match(editor, /rightPanelWideToggleButton\.setAttribute\(\s*["']label["'],\s*nextLabel\s*\)/);
assert.match(editor, /rightPanelWideToggleButton\.closest\(\s*["']sl-tooltip["']\s*\)\?\.setAttribute\(\s*["']content["'],\s*nextLabel\s*\)/);
assert.match(editor, /requestAnimationFrame\(resize\)/);
assert.match(editor, /fovRange\?\.addEventListener\(\s*["']input["']/);
assert.doesNotMatch(
  editor,
  /runtimeAspectWidthInput/,
  "Editor should not query or listen to a removed custom aspect width input"
);
assert.doesNotMatch(
  editor,
  /runtimeAspectHeightInput/,
  "Editor should not query or listen to a removed custom aspect height input"
);
assert.match(
  editor,
  /function\s+getCanvasPoint\(clientX,\s*clientY\)\s*\{[\s\S]*getBoundingClientRect\(\)[\s\S]*x:\s*\(\(clientX\s*-\s*rect\.left\)\s*\/\s*rect\.width\)\s*\*\s*2\s*-\s*1[\s\S]*y:\s*-\(\(clientY\s*-\s*rect\.top\)\s*\/\s*rect\.height\)\s*\*\s*2\s*\+\s*1[\s\S]*\}/,
  "Canvas pointer coordinate conversion should live in one shared helper"
);
assert.match(
  editor,
  /function\s+getPointerFromEvent\(event\)\s*\{[\s\S]*getCanvasPoint\(event\.clientX,\s*event\.clientY\)[\s\S]*pointer\.set\(canvasPoint\.x,\s*canvasPoint\.y\)/,
  "Asset picking should reuse the shared canvas coordinate conversion"
);
assert.match(
  editor,
  /function\s+getTransformPointerFromEvent\(event\)\s*\{[\s\S]*getCanvasPoint\(event\.clientX,\s*event\.clientY\)[\s\S]*x:\s*canvasPoint\.x[\s\S]*y:\s*canvasPoint\.y/,
  "TransformControls pointer input should reuse the shared canvas coordinate conversion"
);
assert.match(
  editor,
  /function\s+getGroundPoint\(clientX,\s*clientY\)\s*\{[\s\S]*getCanvasPoint\(clientX,\s*clientY\)[\s\S]*pointer\.set\(canvasPoint\.x,\s*canvasPoint\.y\)/,
  "Ground-plane placement should reuse the shared canvas coordinate conversion"
);
assert.match(editor, /function\s+isPlayModeActive/);
assert.match(editor, /function\s+getPlayableCharacter/);
assert.match(editor, /selectedAsset\?\.userData\.assetType\s*===\s*["']character["']/);
assert.match(editor, /createPlayModeController\(\{/);
assert.match(editor, /onMoveSpeedChange:\s*updateCameraSpeedControl/);
assert.match(editor, /cameraSpeedInput\?\.addEventListener\(\s*["']input["'],\s*\(\)\s*=>\s*\{/);
assert.match(editor, /cameraSpeedInput\?\.addEventListener\(\s*["']change["'],\s*\(\)\s*=>\s*\{/);
assert.match(editor, /setCameraMoveSpeed\(cameraSpeedInput\.value\)/);
assert.match(editor, /rightPanelToggleButton\?\.addEventListener\(\s*["']click["'],\s*\(\)\s*=>\s*\{/);
assert.match(editor, /rightPanelWideToggleButton\?\.addEventListener\(\s*["']click["'],\s*\(\)\s*=>\s*\{/);
assert.match(editor, /function\s+togglePlayMode/);
assert.match(editor, /document\.body\.classList\.toggle\(\s*["']is-playing["'],\s*playing\s*\)/);
assert.match(editor, /document\.body\.classList\.toggle\(\s*["']is-playing["'],\s*playing\s*\)[\s\S]*updateSelectionFeedback\(\);[\s\S]*render\(\);[\s\S]*if\s*\(playing\)/);
assert.match(editor, /playMode\.handleKeyDown\(event\)/);
assert.match(editor, /playMode\.handleKeyUp\(event\)/);
assert.match(editor, /playMode\.handlePointerMove\(event\)/);
assert.match(editor, /playMode\.update\(deltaTime\)/);
assert.match(
  editor,
  /runButton\?\.addEventListener\(\s*["']click["'],\s*\(\)\s*=>\s*\{[\s\S]*cancelRoadDrawingMode\(\);[\s\S]*togglePlayMode\(\);[\s\S]*\}\s*\)/
);
assert.match(editor, /event\.target\.closest\(\s*["']\[data-system-tool="road"\]["']\s*\)/);
assert.match(editor, /const\s+cameraPreviewList\s*=\s*document\.querySelector\(\s*["']#camera-preview-list["']\s*\)/);
assert.match(editor, /const\s+capturedCameraPreviews\s*=\s*\[\]/);
assert.match(editor, /function\s+capturePlayerCamera/);
assert.match(editor, /new\s+THREE\.PerspectiveCamera\(/);
assert.match(editor, /const\s+capturedAspect\s*=\s*camera\.aspect/);
assert.match(editor, /card\.style\.setProperty\(\s*["']--preview-aspect-ratio["']/);
assert.match(editor, /aspect:\s*capturedAspect/);
assert.match(
  editor,
  /targetCamera\.aspect\s*=\s*sourceCamera\.aspect/,
  "Captured cameras should copy the player camera aspect used by the runtime viewport"
);
assert.match(
  editor,
  /new\s+THREE\.PerspectiveCamera\(\s*camera\.fov,\s*capturedAspect,/,
  "Captured cameras should start with the current runtime camera aspect"
);
assert.doesNotMatch(
  editor,
  /new\s+THREE\.CameraHelper\(/,
  "Captured cameras should not draw camera frustum or direction helper lines in the main viewport"
);
assert.match(editor, /function\s+renderCapturedCameraPreviews/);
assert.match(editor, /preview\.renderer\.render\(scene,\s*preview\.camera\)/);
assert.match(editor, /function\s+getPreviewRenderBounds/);
assert.match(editor, /const\s+cameraAspect\s*=\s*preview\.aspect\s*\?\?\s*preview\.camera\.aspect/);
assert.match(editor, /preview\.renderer\.setViewport\(/);
assert.match(editor, /preview\.renderer\.setScissor\(/);
assert.doesNotMatch(
  editor,
  /preview\.camera\.aspect\s*=\s*width\s*\/\s*height/,
  "Captured camera previews should preserve the captured player camera projection instead of changing it to the sidebar canvas ratio"
);
assert.match(editor, /onCaptureCamera:\s*capturePlayerCamera/);
assert.doesNotMatch(editor, /function\s+syncCameraAspectToCanvas/);
assert.match(editor, /function\s+syncCameraProjection/);
assert.match(editor, /const\s+nextAspect\s*=\s*getActiveCameraAspect\(\)/);
assert.doesNotMatch(
  editor,
  /function\s+getPlayViewportAspect/,
  "The main camera should not use the 16:9 play-frame aspect unless the main renderer is also clipped to that frame"
);
assert.doesNotMatch(
  editor,
  /getComputedStyle\(playViewportFrame\)/,
  "The play frame is a UI overlay; it should not drive the main camera projection"
);
assert.match(
  editor,
  /function\s+getPlayRenderBounds/,
  "Runtime rendering should compute a viewport matching the play frame"
);
assert.match(
  editor,
  /(^|[^.])renderer\.setScissor\(/m,
  "Runtime rendering should scissor to the play frame so runtime aspect is not stretched across the full editor canvas"
);
assert.match(
  editor,
  /(^|[^.])renderer\.setViewport\(/m,
  "Runtime rendering should set a play-frame viewport so camera aspect and output aspect match"
);
assert.match(
  editor,
  /renderer\.setScissorTest\(true\)[\s\S]*renderer\.render\(scene,\s*camera\)[\s\S]*renderer\.setScissorTest\(false\)/,
  "Runtime rendering should enable scissor only for the bounded play-frame render pass"
);
assert.match(
  editor,
  /function\s+render\(\)\s*\{[\s\S]*renderSceneToActiveViewport\(\);[\s\S]*selectionOutline\.render\(selectedAsset,\s*selectionOutlineVisible\);[\s\S]*renderCapturedCameraPreviews\(\);[\s\S]*\}/,
  "The main render pass should refresh captured camera previews"
);
assert.match(editor, /function\s+getViewportBounds/);
assert.match(editor, /document\.querySelector\(\s*["']#left-ui-panel["']\s*\)/);
assert.match(editor, /document\.querySelector\(\s*["']#right-ui-panel["']\s*\)/);
assert.match(editor, /renderer\.setSize\(initialViewport\.width,\s*initialViewport\.height\)/);
assert.match(editor, /renderer\.shadowMap\.enabled\s*=\s*true/);
assert.match(editor, /renderer\.shadowMap\.type\s*=\s*THREE\.PCFSoftShadowMap/);
assert.match(editor, /renderer\.setSize\(viewport\.width,\s*viewport\.height\)/);
assert.match(
  editor,
  /function\s+resize\(\)\s*\{[\s\S]*selectionOutline\.resize\(viewport\.width,\s*viewport\.height\);[\s\S]*resizeCapturedCameraPreviews\(\);[\s\S]*render\(\);[\s\S]*\}/,
  "Window resize should update captured camera preview renderers before rendering"
);
assert.match(editor, /cursorPosition:\s*\{\s*value:\s*new\s+THREE\.Vector2/);
assert.match(editor, /cellGridSize:\s*\{\s*value:\s*gridSnapSize/);
assert.match(editor, /sectionGridSize:\s*\{\s*value:\s*gridSnapSize\s*\*\s*2/);
assert.match(editor, /const\s+scaleSnapSize\s*=\s*1/);
assert.match(editor, /const\s+shadowReceiver\s*=\s*new\s+THREE\.Mesh\(/);
assert.match(editor, /new\s+THREE\.ShadowMaterial\(/);
assert.match(editor, /shadowReceiver\.receiveShadow\s*=\s*true/);
assert.match(editor, /shadowReceiver\.userData\.pickable\s*=\s*false/);
assert.match(editor, /transformControls\.setScaleSnap\(scaleSnapSize\)/);
assert.match(editor, /function\s+configureAssetShadows\(asset\)/);
assert.match(editor, /child\.castShadow\s*=\s*true/);
assert.match(editor, /child\.receiveShadow\s*=\s*true/);
assert.match(editor, /child\.userData\.lightHelper/);
assert.match(editor, /configureAssetShadows\(asset\)/);
assert.match(editor, /function\s+syncSunLightDirection\(asset\)/);
assert.match(editor, /asset\.userData\.assetType\s*!==\s*["']sun-light["']/);
assert.match(editor, /asset\.userData\.sunLight/);
assert.match(editor, /asset\.userData\.sunLightTarget/);
assert.match(editor, /function\s+syncSceneLights\(\)/);
assert.match(editor, /placedAssets\.forEach\(syncSunLightDirection\)/);
assert.match(editor, /syncSceneLights\(\);[\s\S]*renderSceneToActiveViewport\(\);/);
assert.match(editor, /cursorRevealRadius/);
assert.match(editor, /transparent:\s*true/);
assert.match(editor, /depthWrite:\s*false/);
assert.match(editor, /function\s+updateGridCursor/);
assert.match(editor, /updateGridCursor\(event\)/);
assert.match(
  editor,
  /isNavigationBlocked:\s*\(\)\s*=>\s*isPlayModeActive\(\)\s*\|\|\s*dragState\s*\|\|\s*isTransformDragging\s*\|\|\s*transformControls\.dragging/,
  "Road drawing mode should not block right-button camera navigation"
);
assert.match(editor, /beginRoadDrawing\(event\)/);
assert.match(editor, /continueRoadDrawing\(event\)/);
assert.match(editor, /endRoadDrawing\(\)/);
