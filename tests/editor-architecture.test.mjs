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
  "public/src/selection-outline.js",
  "public/src/ue-rock-sync.js",
  "public/src/ui-components.js"
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
assert.doesNotMatch(index, /@shoelace-style\/shoelace/);
assert.match(index, /<script type="module" src="\/src\/ui-components\.js\?v=local-ui"><\/script>/);
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
assert.match(index, /--left-panel-rail-width:\s*52px/);
assert.match(index, /--right-panel-min-width:\s*52px/);
assert.match(index, /--right-panel-default-width:\s*280px/);
assert.match(index, /--right-panel-width:\s*var\(--right-panel-default-width\)/);
assert.match(index, /--right-panel-column-width:\s*228px/);
assert.match(index, /--right-panel-handle-width:\s*10px/);
assert.match(index, /--runtime-aspect-ratio:\s*calc\(16\s*\/\s*9\)/);
assert.match(index, /id="left-ui-panel"/);
assert.match(index, /id="right-ui-panel"/);
assert.match(index, /id="left-panel-content"/);
assert.match(index, /class="left-panel-content"/);
assert.match(index, /id="left-tab-rail"/);
assert.match(index, /class="left-tab-rail"/);
assert.match(index, /role="tablist"/);
assert.match(index, /aria-orientation="vertical"/);
assert.match(index, /id="left-camera-tab"/);
assert.match(index, /class="left-tab-button is-active"/);
assert.match(index, /data-left-panel-tab="camera"/);
assert.match(index, /aria-controls="camera-settings-panel"/);
assert.match(index, /aria-selected="true"/);
assert.match(index, /id="left-model-edit-tab"/);
assert.match(index, /data-left-panel-tab="model-edit"/);
assert.match(index, /aria-controls="model-edit-panel"/);
assert.match(index, /aria-selected="false"/);
assert.match(index, /id="left-terrain-tab"/);
assert.match(index, /data-left-panel-tab="terrain"/);
assert.match(index, /aria-controls="terrain-panel"/);
assert.match(index, /aria-selected="false"/);
assert.match(index, /id="left-unreal5-tab"/);
assert.match(index, /data-left-panel-tab="unreal5"/);
assert.match(index, /name="unreal5"/);
assert.match(index, /aria-controls="unreal5-panel"/);
assert.match(index, /aria-selected="false"/);
assert.match(index, /id="left-scene-outliner-tab"/);
assert.match(index, /data-left-panel-tab="scene-outliner"/);
assert.match(index, /name="list-tree"/);
assert.match(index, /aria-controls="scene-outliner-panel"/);
assert.match(index, /aria-selected="false"/);
assert.match(
  index,
  /id="left-model-edit-tab"[\s\S]*id="left-terrain-tab"[\s\S]*id="left-unreal5-tab"[\s\S]*id="left-scene-outliner-tab"[\s\S]*id="left-camera-tab"/,
  "The left panel tabs should appear as model edit, terrain, unreal 5, scene outliner, then camera"
);
assert.match(index, /id="right-panel-resize-handle"/);
assert.match(index, /class="right-panel-resize-handle"/);
assert.match(index, /role="separator"/);
assert.match(index, /aria-orientation="vertical"/);
assert.match(index, /aria-valuemin="52"/);
assert.match(index, /id="right-panel-guide-rail"/);
assert.match(index, /class="right-panel-guide-rail"/);
assert.match(index, /data-camera-guide="thirds"/);
assert.match(index, /data-camera-guide="center"/);
assert.match(index, /data-camera-guide="safe"/);
assert.match(index, /data-camera-guide="perspective"/);
assert.match(index, /data-camera-guide="horizon"/);
assert.match(index, /name="grid-3x3"/);
assert.match(index, /name="crosshair"/);
assert.match(index, /name="safe-frame"/);
assert.match(index, /name="perspective-dot"/);
assert.match(index, /name="horizon-line"/);
assert.doesNotMatch(index, /id="right-panel-toggle"/);
assert.doesNotMatch(index, /id="right-panel-wide-toggle"/);
assert.doesNotMatch(index, /data-panel-tool="toggle-right-panel-width"/);
assert.match(index, /\.right-panel-resize-handle\s*\{/);
assert.match(index, /cursor:\s*ew-resize/);
assert.match(index, /touch-action:\s*none/);
const resizeHandleBeforeRule = index.match(/\.right-panel-resize-handle::before\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert.match(resizeHandleBeforeRule, /width:\s*4px/);
assert.match(resizeHandleBeforeRule, /height:\s*56px/);
assert.doesNotMatch(resizeHandleBeforeRule, /transition:/);
assert.doesNotMatch(index, /\.right-panel-resize-handle:hover::before/);
assert.match(index, /body\.is-resizing-right-panel/);
assert.match(index, /body\.is-right-panel-minimized\s+\.camera-preview-list\s*\{[\s\S]*display:\s*none/);
assert.match(index, /id="camera-preview-list"/);
assert.match(index, /id="camera-settings-panel"/);
assert.match(index, /data-left-panel-panel="camera"/);
assert.match(index, /id="model-edit-panel"/);
assert.match(index, /data-left-panel-panel="model-edit"/);
assert.match(index, /aria-label="model edit"/);
assert.match(index, /id="model-transform-empty"/);
assert.match(index, /id="model-transform-details"/);
assert.match(index, /id="model-transform-name"/);
assert.match(index, /id="model-transform-type"/);
assert.match(index, /id="model-location-x"/);
assert.match(index, /id="model-location-y"/);
assert.match(index, /id="model-location-z"/);
assert.match(index, /id="model-rotation-x"/);
assert.match(index, /id="model-rotation-y"/);
assert.match(index, /id="model-rotation-z"/);
assert.match(index, /id="model-scale-x"/);
assert.match(index, /id="model-scale-y"/);
assert.match(index, /id="model-scale-z"/);
assert.match(index, /cm/);
assert.match(index, /deg/);
assert.match(index, /id="terrain-panel"/);
assert.match(index, /data-left-panel-panel="terrain"/);
assert.match(index, /aria-label="terrain"/);
assert.match(index, /id="unreal5-panel"/);
assert.match(index, /data-left-panel-panel="unreal5"/);
assert.match(index, /aria-label="unreal 5"/);
assert.match(index, /id="ue-rock-sync-status"/);
assert.match(index, /id="ue-rock-sync-button"/);
assert.match(index, /data-ue-rock-sync/);
assert.match(index, /id="ue-rock-sync-source"/);
assert.match(index, /\/ue-sync\/scene\.manifest\.json/);
assert.match(index, /id="ue-semantic-mode-button"/);
assert.match(index, /data-ue-semantic-mode/);
assert.match(index, /id="local-setup-check-button"/);
assert.match(index, /data-local-setup-check/);
assert.match(index, />\s*Check Local Setup\s*<\/button>/);
assert.match(index, /id="ue-semantic-rules-source"/);
assert.match(index, /\/ue-sync\/semantic\.rules\.json/);
assert.match(index, /id="ue-rock-sync-count"/);
assert.match(index, /id="local-setup-check-status"/);
assert.match(index, /id="local-setup-check-results"/);
assert.match(index, /class="local-setup-check-results"/);
assert.match(index, /id="scene-outliner-panel"/);
assert.match(index, /data-left-panel-panel="scene-outliner"/);
assert.match(index, /aria-label="scene outliner"/);
assert.match(index, /id="scene-outliner-empty"/);
assert.match(index, /id="scene-outliner-list"/);
assert.match(index, /class="scene-outliner-list"/);
assert.match(
  index,
  /id="scene-outliner-panel"[\s\S]*class="scene-outliner-model-container"[\s\S]*id="model-transform-empty"[\s\S]*id="model-transform-details"[\s\S]*class="scene-outliner-list-container"[\s\S]*id="scene-outliner-empty"[\s\S]*id="scene-outliner-list"/,
  "The scene outliner should show selected model information above the scene model list"
);
assert.doesNotMatch(
  index,
  /id="model-edit-panel"[\s\S]*id="model-transform-empty"[\s\S]*id="scene-outliner-panel"/,
  "The model edit panel is reserved for future AI model generation and should not contain model transform details"
);
assert.match(index, /hidden/);
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
assert.match(index, /\.left-panel-content\s*\{[\s\S]*width:\s*calc\(100%\s*-\s*var\(--left-panel-rail-width\)\)[\s\S]*overflow:\s*auto/);
assert.match(index, /\.left-tab-rail\s*\{[\s\S]*right:\s*0[\s\S]*width:\s*var\(--left-panel-rail-width\)[\s\S]*background:\s*rgba\(24,\s*24,\s*24,\s*0\.98\)/);
assert.match(index, /\.left-tab-rail\s*\{[\s\S]*padding:\s*8px\s+0/);
assert.match(index, /\.left-tab-rail\s+sl-tooltip\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*100%/);
assert.match(index, /\.left-tab-button::part\(base\),\s*[\s\S]*\.left-tab-button\s*\{/);
const leftTabBaseRule = index.match(/\.left-tab-button::part\(base\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const leftTabHoverRule = index.match(/\.left-tab-button::part\(base\):hover\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const leftTabActiveRule = index.match(/\.left-tab-button\.is-active\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert.match(index, /\.left-tab-button::part\(base\),\s*[\s\S]*\.left-tab-button\s*\{[\s\S]*width:\s*100%[\s\S]*border-radius:\s*0/);
assert.match(leftTabBaseRule, /border:\s*0/);
assert.match(leftTabBaseRule, /background:\s*transparent/);
assert.doesNotMatch(leftTabBaseRule, /transition:/);
assert.doesNotMatch(leftTabHoverRule, /background:/);
assert.match(leftTabActiveRule, /background:\s*var\(--editor-panel-bg\)/);
assert.doesNotMatch(leftTabActiveRule, /border-color:/);
assert.match(index, /\.settings-panel\s*\{[\s\S]*padding:\s*14px/);
assert.match(index, /\.settings-panel\[hidden\]\s*\{[\s\S]*display:\s*none/);
assert.match(index, /\.right-panel-guide-rail\s*\{[\s\S]*width:\s*var\(--right-panel-min-width\)/);
assert.match(index, /\.right-panel-guide-rail\s+sl-tooltip\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*100%/);
assert.match(index, /\.right-panel-guide-button::part\(base\),\s*[\s\S]*\.right-panel-guide-button\s*\{[\s\S]*height:\s*38px/);
assert.match(index, /\.right-panel-guide-button\.is-active\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.1\)/);
assert.match(index, /\.scene-outliner-panel\s*\{[\s\S]*height:\s*100%[\s\S]*overflow:\s*hidden/);
assert.match(index, /\.scene-outliner-model-container,\s*[\s\S]*\.scene-outliner-list-container\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/);
assert.match(index, /\.scene-outliner-list-container\s*\{[\s\S]*flex:\s*1 1 auto[\s\S]*overflow:\s*hidden/);
assert.match(index, /\.model-transform-details\[hidden\],\s*[\s\S]*\.model-transform-empty\[hidden\]\s*\{[\s\S]*display:\s*none/);
assert.match(index, /\.model-coordinate-grid\s*\{[\s\S]*display:\s*grid/);
assert.match(index, /\.model-transform-section\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/);
assert.match(index, /\.ue-rock-sync-card\s*\{[\s\S]*border:\s*1px solid/);
assert.match(index, /\.ue-rock-sync-button\s*\{[\s\S]*width:\s*100%/);
assert.match(index, /\.ue-rock-sync-meta\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums/);
assert.match(index, /\.local-setup-check-results\s*\{[\s\S]*display:\s*flex/);
assert.match(index, /\.local-setup-check-item\s*\{[\s\S]*border-left-width:\s*3px/);
assert.match(index, /\.local-setup-check-item\.is-ok\s*\{[\s\S]*border-left-color:\s*#57a65a/);
assert.match(index, /\.local-setup-check-item\.is-warning\s*\{[\s\S]*border-left-color:\s*#d18b4b/);
assert.match(index, /\.local-setup-check-item\.is-error\s*\{[\s\S]*border-left-color:\s*#ff4d4d/);
assert.match(index, /\.scene-outliner-list\s*\{[\s\S]*display:\s*flex/);
assert.match(index, /\.scene-outliner-list\s*\{[\s\S]*overflow:\s*auto/);
assert.match(index, /\.scene-outliner-item\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
assert.match(index, /\.scene-outliner-item\.is-selected\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.16\)/);
assert.match(index, /\.scene-outliner-empty\[hidden\],\s*[\s\S]*\.scene-outliner-list\[hidden\]\s*\{[\s\S]*display:\s*none/);
assert.match(index, /\.right-ui-panel/);
assert.match(index, /\.right-ui-panel::before\s*\{[\s\S]*width:\s*var\(--right-panel-min-width\)[\s\S]*background:\s*rgba\(24,\s*24,\s*24,\s*0\.98\)/);
assert.match(index, /id="right-panel-content"/);
assert.match(index, /class="right-panel-content"/);
assert.match(index, /\.camera-preview-list/);
assert.match(index, /id="right-panel-secondary-column"/);
assert.match(index, /class="right-panel-secondary-column"/);
assert.match(index, /class="right-panel-secondary-column camera-ui-column"/);
assert.match(index, /id="camera-ui-list"/);
assert.match(index, /class="camera-ui-list"/);
assert.match(index, /id="right-panel-tertiary-column"/);
assert.match(index, /id="right-panel-quaternary-column"/);
assert.match(index, /id="right-panel-quinary-column"/);
assert.match(
  index,
  /\.right-panel-content\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(5,\s*var\(--right-panel-column-width\)\)/,
  "Resizable right panel should keep all columns at a fixed width"
);
assert.match(index, /padding-left:\s*var\(--right-panel-min-width\)/);
assert.doesNotMatch(
  index,
  /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(var\(--right-panel-column-width\),\s*1fr\)\)/,
  "Right panel columns should not scale with fractional tracks"
);
assert.match(index, /\.camera-preview-card/);
assert.match(index, /\.camera-preview-list,\s*[\s\S]*\.camera-ui-list\s*\{[\s\S]*display:\s*flex[\s\S]*gap:\s*10px[\s\S]*padding:\s*10px/);
assert.match(index, /\.camera-ui-column\s*\{[\s\S]*padding:\s*0[\s\S]*border-left:\s*0/);
assert.match(index, /\.camera-ui-column\s*\{[\s\S]*box-shadow:\s*inset\s+1px\s+0\s+0\s+var\(--editor-panel-border\)/);
assert.match(index, /\.camera-ui-card/);
assert.match(index, /\.camera-depth-canvas\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*100%[\s\S]*height:\s*100%/);
assert.match(index, /--preview-aspect-ratio/);
assert.doesNotMatch(index, /\.camera-preview-card\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
assert.doesNotMatch(index, /\.camera-ui-card\s*\{[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
assert.match(index, /--camera-preview-border-width:\s*1px/);
assert.match(index, /border:\s*var\(--camera-preview-border-width\)\s+solid\s+#000/);
assert.match(index, /\.camera-preview-card,\s*[\s\S]*\.camera-ui-card\s*\{[\s\S]*aspect-ratio:\s*var\(--preview-aspect-ratio,\s*var\(--runtime-aspect-ratio\)\)/);
assert.match(index, /\.camera-preview-card,\s*[\s\S]*\.camera-ui-card\s*\{[\s\S]*border:\s*var\(--camera-preview-border-width\)\s+solid\s+#000/);
assert.match(index, /\.camera-preview-card,\s*[\s\S]*\.camera-ui-card\s*\{[\s\S]*position:\s*relative/);
assert.match(index, /\.camera-preview-guide-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*pointer-events:\s*none/);
assert.match(index, /body\.has-camera-guide-thirds\s+\.camera-preview-guide-thirds/);
assert.match(index, /body\.has-camera-guide-center\s+\.camera-preview-guide-center/);
assert.match(index, /body\.has-camera-guide-safe\s+\.camera-preview-guide-safe/);
assert.match(index, /body\.has-camera-guide-perspective\s+\.camera-preview-guide-perspective/);
assert.match(index, /body\.has-camera-guide-horizon\s+\.camera-preview-guide-horizon/);
assert.match(index, /--camera-guide-line-width:\s*0\.5px/);
assert.match(index, /\.camera-preview-guide-line\s*\{[\s\S]*background:\s*#000/);
assert.match(index, /\.camera-preview-guide-line\.is-vertical\s*\{[\s\S]*width:\s*var\(--camera-guide-line-width\)/);
assert.match(index, /\.camera-preview-guide-line\.is-horizontal\s*\{[\s\S]*height:\s*var\(--camera-guide-line-width\)/);
assert.match(index, /\.camera-preview-guide-safe::before\s*\{[\s\S]*border:\s*var\(--camera-guide-line-width\)\s+solid\s+#000/);
assert.match(index, /\.camera-preview-guide-perspective\s*\{[\s\S]*pointer-events:\s*auto/);
assert.match(index, /\.camera-preview-perspective-dot\s*\{[\s\S]*background:\s*transparent/);
assert.match(index, /\.camera-preview-perspective-dot\s*\{[\s\S]*border:\s*1px\s+solid\s+#ffd400/);
assert.match(index, /\.camera-preview-perspective-dot\s*\{[\s\S]*width:\s*16px[\s\S]*height:\s*9px/);
assert.match(index, /\.camera-preview-perspective-dot\s*\{[\s\S]*border-radius:\s*1px/);
assert.match(index, /\.camera-preview-perspective-svg\s*\{[\s\S]*position:\s*absolute[\s\S]*pointer-events:\s*none/);
assert.match(index, /\.camera-preview-perspective-link\s*\{[\s\S]*stroke:\s*#000[\s\S]*stroke-width:\s*var\(--camera-guide-line-width\)/);
assert.match(index, /\.camera-preview-guide-horizon\s*\{[\s\S]*pointer-events:\s*auto/);
assert.match(index, /\.camera-preview-horizon-line\s*\{[\s\S]*height:\s*var\(--camera-guide-line-width\)[\s\S]*background:\s*#000/);
assert.match(index, /\.camera-preview-horizon-hit-area\s*\{[\s\S]*height:\s*18px[\s\S]*cursor:\s*ns-resize/);
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

const uiComponents = read("public/src/ui-components.js");
assert.match(uiComponents, /customElements\.define\(\s*["']sl-icon["']/);
assert.match(uiComponents, /customElements\.define\(\s*["']sl-icon-button["']/);
assert.match(uiComponents, /customElements\.define\(\s*["']sl-tooltip["']/);
assert.match(uiComponents, /part="base"/);
assert.match(uiComponents, /unreal5/);
assert.match(uiComponents, /font-size="9"/);
assert.match(uiComponents, />UE<\/text>/);
assert.match(uiComponents, /"list-tree"/);
assert.match(uiComponents, /"grid-3x3"/);
assert.match(uiComponents, /crosshair/);
assert.match(uiComponents, /"safe-frame"/);
assert.match(uiComponents, /"perspective-dot"/);
assert.match(uiComponents, /"horizon-line"/);
assert.doesNotMatch(uiComponents, /"chevron-double-left"/);
assert.doesNotMatch(uiComponents, /"chevron-double-right"/);
assert.match(uiComponents, /"play-fill"/);

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
assert.match(editor, /import\s+\{\s*GLTFLoader\s*\}\s+from\s+["']three\/addons\/loaders\/GLTFLoader\.js["']/);
assert.doesNotMatch(
  editor,
  /import\s+\{\s*SimplifyModifier\s*\}/,
  "Editor import should not run expensive browser-side mesh simplification by default"
);
assert.doesNotMatch(
  editor,
  /import\s+\{\s*mergeVertices\s*\}/,
  "Editor import should not weld geometry on the main thread by default"
);
assert.doesNotMatch(editor, /new\s+SimplifyModifier\(\)/);
assert.match(editor, /import\s+\{\s*createUnrealRockSyncController\s*\}\s+from\s+["']\.\/ue-rock-sync\.js["']/);
assert.match(editor, /const\s+DEFAULT_CAMERA_SETTINGS\s*=\s*\{/);
assert.doesNotMatch(
  editor,
  /const\s+ASPECT_PRESETS\s*=\s*\[/,
  "Runtime aspect presets should be parsed from the existing button data instead of duplicated in JS"
);
assert.doesNotMatch(editor, /from\s+["']\.\/shortcuts\.js["']/);
assert.match(editor, /const\s+runButton\s*=\s*document\.querySelector\(\s*["']\[data-system-tool="run"\]["']\s*\)/);
assert.match(editor, /const\s+roadButton\s*=\s*document\.querySelector\(\s*["']\[data-system-tool="road"\]["']\s*\)/);
assert.doesNotMatch(editor, /rightPanelToggleButton/);
assert.doesNotMatch(editor, /rightPanelWideToggleButton/);
assert.match(editor, /const\s+leftPanelTabs\s*=\s*Array\.from\(document\.querySelectorAll\(\s*["']\[data-left-panel-tab\]["']\s*\)\)/);
assert.match(editor, /const\s+leftPanelPanels\s*=\s*Array\.from\(document\.querySelectorAll\(\s*["']\[data-left-panel-panel\]["']\s*\)\)/);
assert.match(editor, /const\s+modelTransformEmpty\s*=\s*document\.querySelector\(\s*["']#model-transform-empty["']\s*\)/);
assert.match(editor, /const\s+modelTransformDetails\s*=\s*document\.querySelector\(\s*["']#model-transform-details["']\s*\)/);
assert.match(editor, /const\s+modelLocationX\s*=\s*document\.querySelector\(\s*["']#model-location-x["']\s*\)/);
assert.match(editor, /const\s+modelLocationY\s*=\s*document\.querySelector\(\s*["']#model-location-y["']\s*\)/);
assert.match(editor, /const\s+modelLocationZ\s*=\s*document\.querySelector\(\s*["']#model-location-z["']\s*\)/);
assert.match(editor, /const\s+modelRotationX\s*=\s*document\.querySelector\(\s*["']#model-rotation-x["']\s*\)/);
assert.match(editor, /const\s+modelRotationY\s*=\s*document\.querySelector\(\s*["']#model-rotation-y["']\s*\)/);
assert.match(editor, /const\s+modelRotationZ\s*=\s*document\.querySelector\(\s*["']#model-rotation-z["']\s*\)/);
assert.match(editor, /const\s+modelScaleX\s*=\s*document\.querySelector\(\s*["']#model-scale-x["']\s*\)/);
assert.match(editor, /const\s+modelScaleY\s*=\s*document\.querySelector\(\s*["']#model-scale-y["']\s*\)/);
assert.match(editor, /const\s+modelScaleZ\s*=\s*document\.querySelector\(\s*["']#model-scale-z["']\s*\)/);
assert.match(editor, /const\s+sceneOutlinerEmpty\s*=\s*document\.querySelector\(\s*["']#scene-outliner-empty["']\s*\)/);
assert.match(editor, /const\s+sceneOutlinerList\s*=\s*document\.querySelector\(\s*["']#scene-outliner-list["']\s*\)/);
assert.match(editor, /const\s+ueRockSyncButton\s*=\s*document\.querySelector\(\s*["']#ue-rock-sync-button["']\s*\)/);
assert.match(editor, /const\s+ueRockSyncStatus\s*=\s*document\.querySelector\(\s*["']#ue-rock-sync-status["']\s*\)/);
assert.match(editor, /const\s+ueRockSyncCount\s*=\s*document\.querySelector\(\s*["']#ue-rock-sync-count["']\s*\)/);
assert.match(editor, /const\s+ueSemanticModeButton\s*=\s*document\.querySelector\(\s*["']#ue-semantic-mode-button["']\s*\)/);
assert.match(editor, /const\s+localSetupCheckButton\s*=\s*document\.querySelector\(\s*["']#local-setup-check-button["']\s*\)/);
assert.match(editor, /const\s+localSetupCheckStatus\s*=\s*document\.querySelector\(\s*["']#local-setup-check-status["']\s*\)/);
assert.match(editor, /const\s+localSetupCheckResults\s*=\s*document\.querySelector\(\s*["']#local-setup-check-results["']\s*\)/);
assert.match(editor, /const\s+ueProjectPathInput\s*=\s*document\.querySelector\(\s*["']#ue-project-path-input["']\s*\)/);
assert.match(editor, /const\s+deployUeExportToolsButton\s*=\s*document\.querySelector\(\s*["']#deploy-ue-export-tools-button["']\s*\)/);
assert.match(editor, /const\s+ueExportDeployStatus\s*=\s*document\.querySelector\(\s*["']#ue-export-deploy-status["']\s*\)/);
assert.match(editor, /const\s+ueExportDeployResults\s*=\s*document\.querySelector\(\s*["']#ue-export-deploy-results["']\s*\)/);
assert.match(index, /id="ue-project-path-input"/);
assert.match(index, /id="deploy-ue-export-tools-button"/);
assert.match(index, />\s*Deploy UE Export Tools\s*</);
assert.match(index, /id="ue-export-deploy-status"/);
assert.match(index, /id="ue-export-deploy-results"/);
assert.match(editor, /const\s+rightPanel\s*=\s*document\.querySelector\(\s*["']#right-ui-panel["']\s*\)/);
assert.match(editor, /const\s+rightPanelResizeHandle\s*=\s*document\.querySelector\(\s*["']#right-panel-resize-handle["']\s*\)/);
assert.match(editor, /const\s+cameraGuideButtons\s*=\s*Array\.from\(document\.querySelectorAll\(\s*["']\[data-camera-guide\]["']\s*\)\)/);
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
assert.match(editor, /const\s+unrealCentimetersPerSceneUnit\s*=\s*100/);
assert.match(editor, /function\s+formatUnrealCentimeters\(value\)/);
assert.match(editor, /value\s*\*\s*unrealCentimetersPerSceneUnit/);
assert.match(editor, /return\s+`\$\{formatted\}\s+cm`/);
assert.match(editor, /function\s+updateModelTransformPanel\(\)/);
assert.match(editor, /modelTransformEmpty\.hidden\s*=\s*hasSelection/);
assert.match(editor, /modelTransformDetails\.hidden\s*=\s*!hasSelection/);
assert.match(editor, /modelLocationX\.textContent\s*=\s*formatUnrealCentimeters\(selectedAsset\.position\.x\)/);
assert.match(editor, /modelLocationY\.textContent\s*=\s*formatUnrealCentimeters\(selectedAsset\.position\.y\)/);
assert.match(editor, /modelLocationZ\.textContent\s*=\s*formatUnrealCentimeters\(selectedAsset\.position\.z\)/);
assert.match(editor, /function\s+setLeftPanelTab\(tabName\)/);
assert.match(editor, /tab\.setAttribute\(\s*["']aria-selected["'],\s*`\$\{active\}`\s*\)/);
assert.match(editor, /panel\.hidden\s*=\s*panel\.dataset\.leftPanelPanel\s*!==\s*tabName/);
assert.match(editor, /function\s+getSceneOutlinerItems\(\)/);
assert.match(editor, /placedAssets\.map\(\(asset\)\s*=>/);
assert.match(editor, /Array\.from\(roadTiles\.values\(\)\)\.map/);
assert.match(editor, /ueRockSync\.group\.children\.map/);
assert.match(editor, /capturedCameraPreviews\.map/);
assert.match(editor, /function\s+renderSceneOutliner\(\)/);
assert.match(editor, /sceneOutlinerList\.replaceChildren\(/);
assert.match(editor, /let\s+sceneOutlinerDirty\s*=\s*true/);
assert.match(editor, /function\s+markSceneOutlinerDirty\(\)/);
assert.match(editor, /function\s+flushSceneOutliner\(\)/);
assert.match(editor, /if\s*\(!sceneOutlinerDirty\)\s*\{\s*return;\s*\}/);
assert.match(editor, /button\.dataset\.sceneOutlinerItemId\s*=/);
assert.match(editor, /button\.classList\.toggle\(\s*["']is-selected["'],\s*item\.object\s*===\s*selectedAsset/);
assert.match(editor, /function\s+selectSceneOutlinerItem\(itemId\)/);
assert.match(editor, /function\s+getSelectableSceneObjects\(\)/);
assert.match(editor, /return\s+\[\.\.\.placedAssets,\s*\.\.\.ueRockSync\.group\.children\]/);
assert.match(editor, /function\s+getEditableAssetCollection\(asset\)/);
assert.match(editor, /ueRockSync\.group\.children\.includes\(asset\)/);
assert.match(editor, /function\s+duplicateImportedAsset\(sourceAsset\)/);
assert.match(editor, /sourceAsset\.clone\(true\)/);
assert.match(editor, /collection\.splice\(safeIndex,\s*0,\s*asset\)/);
assert.match(
  editor,
  /function\s+prepareTransformDuplicate\(event\)[\s\S]*duplicatedTransformAsset\s*=\s*duplicateAssetForTransform\(selectedAsset\)[\s\S]*duplicateOnTransformDrag\s*=\s*true/,
  "Alt-drag duplication should attach the duplicate before TransformControls records the drag start"
);
assert.match(
  editor,
  /duplicatedTransformAsset\s*=\s*duplicateOnTransformDrag\s*&&\s*selectedAsset[\s\S]*duplicatedTransformAsset\s*\|\|/,
  "TransformControls mouseDown should reuse the duplicate prepared during pointerdown"
);
assert.match(editor, /function\s+duplicateSelectedAsset\(\)/);
assert.match(editor, /pushUndo\(\{\s*type:\s*["']duplicate["'],\s*asset:\s*duplicate\s*\}\)/);
assert.match(editor, /let\s+copiedAsset\s*=\s*null/);
assert.match(editor, /function\s+copySelectedAsset\(\)/);
assert.match(editor, /copiedAsset\s*=\s*selectedAsset/);
assert.match(editor, /function\s+pasteCopiedAsset\(\)/);
assert.match(
  editor,
  /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*code\s*===\s*["']keyd["'][\s\S]*duplicateSelectedAsset\(\)/,
  "Ctrl/Cmd+D should duplicate the selected local or imported model"
);
assert.match(
  editor,
  /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*code\s*===\s*["']keyc["'][\s\S]*copySelectedAsset\(\)/,
  "Ctrl/Cmd+C should copy the selected local or imported model into the editor clipboard"
);
assert.match(
  editor,
  /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*code\s*===\s*["']keyv["'][\s\S]*pasteCopiedAsset\(\)/,
  "Ctrl/Cmd+V should paste the copied local or imported model"
);
assert.match(editor, /raycaster\.intersectObjects\(getSelectableSceneObjects\(\),\s*true\)/);
assert.match(editor, /const\s+ueRockSync\s*=\s*createUnrealRockSyncController\(/);
assert.match(editor, /manifestUrl:\s*["']\/ue-sync\/scene\.manifest\.json["']/);
assert.match(editor, /fallbackManifestUrl:\s*["']\/ue-sync\/rocks\.instances\.json["']/);
assert.match(editor, /semanticRulesUrl:\s*["']\/ue-sync\/semantic\.rules\.json["']/);
assert.match(editor, /loader:\s*new\s+GLTFLoader\(\)/);
assert.match(editor, /simplifyModifier:\s*null/);
assert.match(editor, /mergeVertices:\s*null/);
assert.match(editor, /reductionRatio:\s*0/);
assert.match(editor, /onStatusChange:\s*updateUnrealRockSyncStatus/);
assert.match(editor, /onSynced:\s*\(manifest\)\s*=>\s*\{[\s\S]*adaptImportedSceneToManifest\(manifest\)[\s\S]*markSceneOutlinerDirty\(\)/);
assert.match(editor, /function\s+setImportedSceneDisplayMode\(mode\)/);
assert.match(editor, /ueRockSync\.setDisplayMode\(mode\)/);
assert.match(editor, /function\s+setLocalSetupCheckBusy\(busy\)/);
assert.match(editor, /function\s+createLocalSetupCheckItem\(check\)/);
assert.match(editor, /function\s+renderLocalSetupChecks\(payload\)/);
assert.match(editor, /function\s+renderLocalSetupCheckFailure\(error\)/);
assert.match(editor, /async\s+function\s+runLocalSetupCheck\(\)/);
assert.match(editor, /fetch\(\s*["']\/api\/environment-check["']/);
assert.match(editor, /function\s+formatModelDegrees\(value\)/);
assert.match(editor, /THREE\.MathUtils\.radToDeg\(value\)/);
assert.match(editor, /function\s+formatModelScale\(value\)/);
assert.match(editor, /modelRotationX\.textContent\s*=\s*formatModelDegrees\(selectedAsset\.rotation\.x\)/);
assert.match(editor, /modelScaleX\.textContent\s*=\s*formatModelScale\(selectedAsset\.scale\.x\)/);
assert.match(editor, /function\s+setUeExportDeployBusy\(busy\)/);
assert.match(editor, /function\s+renderUeExportDeployResult\(payload\)/);
assert.match(editor, /async\s+function\s+deployUeExportTools\(\)/);
assert.match(editor, /fetch\(\s*["']\/api\/deploy-ue-export-tools["'][\s\S]*method:\s*["']POST["']/);
assert.match(editor, /uprojectPath:\s*ueProjectPathInput\?\.value\s*\|\|\s*["']["']/);
assert.match(editor, /function\s+adaptImportedSceneToManifest\(manifest\)/);
assert.match(editor, /gridMaterial\.uniforms\.fadeDistance\.value/);
assert.match(editor, /camera\.far\s*=\s*Math\.max\(camera\.far,\s*nextGridSize\s*\*\s*2\)/);
assert.match(editor, /function\s+updateUnrealRockSyncStatus\(status\)/);
assert.match(editor, /ueRockSyncButton\?\.addEventListener\(\s*["']click["']/);
assert.match(editor, /ueSemanticModeButton\?\.addEventListener\(\s*["']click["']/);
assert.match(editor, /localSetupCheckButton\?\.addEventListener\(\s*["']click["'],\s*runLocalSetupCheck\)/);
assert.match(editor, /deployUeExportToolsButton\?\.addEventListener\(\s*["']click["'],\s*deployUeExportTools\)/);
assert.match(editor, /const\s+rightPanelMinWidth\s*=\s*52/);
assert.match(editor, /const\s+rightPanelDefaultWidth\s*=\s*280/);
assert.match(editor, /const\s+rightPanelColumnWidth\s*=\s*228/);
assert.match(editor, /const\s+rightPanelMaxColumns\s*=\s*5/);
assert.match(editor, /let\s+rightPanelWidth\s*=/);
assert.match(editor, /let\s+rightPanelResizeState\s*=\s*null/);
assert.match(editor, /function\s+getRightPanelMaxWidth/);
assert.match(editor, /function\s+getRightPanelWidthSteps/);
assert.match(editor, /function\s+snapRightPanelWidth/);
assert.match(editor, /function\s+getRightPanelStepIndex/);
assert.match(editor, /function\s+setRightPanelStep\(index\)/);
assert.match(editor, /rightPanelMinWidth\s*\+\s*rightPanelColumnWidth\s*\*\s*columnCount/);
assert.match(editor, /function\s+setRightPanelWidth\(value/);
assert.match(editor, /const\s+nextWidth\s*=\s*snapRightPanelWidth\(value\)/);
assert.match(editor, /style\.setProperty\(\s*["']--right-panel-width["'],\s*`\$\{nextWidth\}px`/);
assert.match(editor, /classList\.toggle\(\s*["']is-right-panel-minimized["']/);
assert.match(editor, /function\s+beginRightPanelResize\(event\)/);
assert.match(editor, /function\s+updateRightPanelResize\(event\)/);
assert.match(editor, /function\s+endRightPanelResize\(event\)/);
assert.match(editor, /function\s+handleRightPanelResizeKey\(event\)/);
assert.doesNotMatch(editor, /rightPanelCollapsed/);
assert.doesNotMatch(editor, /rightPanelWide/);
assert.doesNotMatch(editor, /setRightPanelCollapsed/);
assert.doesNotMatch(editor, /setRightPanelWide/);
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
assert.doesNotMatch(
  editor,
  /if\s*\(action\.type\s*===\s*["']transform["']\)[\s\S]{0,160}placedAssets\.includes\(action\.asset\)/,
  "Imported UE models should support transform undo, so transform undo cannot be limited to placedAssets"
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
assert.match(editor, /leftPanelTabs\.forEach\(\(tab\)\s*=>\s*\{/);
assert.match(editor, /setLeftPanelTab\(tab\.dataset\.leftPanelTab\)/);
assert.match(editor, /rightPanelResizeHandle\?\.addEventListener\(\s*["']pointerdown["'],\s*beginRightPanelResize\s*\)/);
assert.match(editor, /rightPanelResizeHandle\?\.addEventListener\(\s*["']keydown["'],\s*handleRightPanelResizeKey\s*\)/);
assert.match(editor, /rightPanelResizeHandle\?\.addEventListener\(\s*["']dblclick["']/);
assert.match(editor, /window\.addEventListener\(\s*["']pointermove["'],\s*updateRightPanelResize\s*\)/);
assert.match(editor, /window\.addEventListener\(\s*["']pointerup["'],\s*endRightPanelResize\s*\)/);
assert.match(editor, /window\.addEventListener\(\s*["']pointercancel["'],\s*endRightPanelResize\s*\)/);
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
assert.match(editor, /const\s+cameraUiList\s*=\s*document\.querySelector\(\s*["']#camera-ui-list["']\s*\)/);
assert.match(editor, /const\s+capturedCameraPreviews\s*=\s*\[\]/);
assert.match(editor, /const\s+activeCameraGuides\s*=\s*new\s+Set\(\)/);
assert.match(editor, /function\s+setCameraGuideMode/);
assert.match(editor, /document\.body\.classList\.toggle\(`has-camera-guide-\$\{mode\}`/);
assert.match(editor, /function\s+createCameraPreviewGuideOverlay/);
assert.match(editor, /function\s+createPerspectiveGuide/);
assert.match(editor, /function\s+updatePerspectiveGuide/);
assert.match(editor, /function\s+setPerspectiveGuidePointFromEvent/);
assert.match(editor, /function\s+createHorizonGuide/);
assert.match(editor, /function\s+updateHorizonGuide/);
assert.match(editor, /function\s+setHorizonGuideFromEvent/);
assert.match(editor, /function\s+calculateCameraHorizonPosition/);
assert.match(editor, /function\s+setCameraPitchFromHorizonPosition/);
assert.match(editor, /camera\.getWorldDirection\(horizonForward\)/);
assert.match(editor, /horizonPointA\.project\(camera\)/);
assert.match(editor, /guide\.camera/);
assert.match(editor, /setCameraPitchFromHorizonPosition\(guide\.camera,\s*guide\.position\)/);
assert.match(editor, /setHorizonGuideFromEvent\(guide,\s*event\)[\s\S]*render\(\)/);
assert.match(editor, /pointerId/);
assert.match(editor, /setPointerCapture/);
assert.match(editor, /const\s+perspectiveFrameCorners\s*=\s*\[/);
assert.match(editor, /const\s+perspectiveScreenCorners\s*=\s*\[/);
assert.match(editor, /function\s+createPerspectiveGuideLink/);
assert.match(editor, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg",\s*"line"\)/);
assert.match(editor, /function\s+capturePlayerCamera/);
assert.match(editor, /new\s+THREE\.PerspectiveCamera\(/);
assert.match(editor, /const\s+uiCard\s*=\s*document\.createElement\(\s*["']div["']\s*\)/);
assert.match(editor, /const\s+depthCanvas\s*=\s*document\.createElement\(\s*["']canvas["']\s*\)/);
assert.match(editor, /const\s+previewRenderCanvas\s*=\s*document\.createElement\(\s*["']canvas["']\s*\)/);
assert.match(editor, /const\s+depthRenderCanvas\s*=\s*document\.createElement\(\s*["']canvas["']\s*\)/);
assert.match(editor, /const\s+sharedPreviewRenderer\s*=\s*new\s+THREE\.WebGLRenderer\(\s*\{[\s\S]*canvas:\s*previewRenderCanvas/);
assert.match(editor, /const\s+sharedDepthRenderer\s*=\s*new\s+THREE\.WebGLRenderer\(\s*\{[\s\S]*canvas:\s*depthRenderCanvas/);
assert.doesNotMatch(editor, /const\s+previewRenderer\s*=\s*new\s+THREE\.WebGLRenderer/);
assert.doesNotMatch(editor, /const\s+depthRenderer\s*=\s*new\s+THREE\.WebGLRenderer/);
assert.match(editor, /uiCard\.className\s*=\s*["']camera-ui-card["']/);
assert.match(editor, /depthCanvas\.className\s*=\s*["']camera-depth-canvas["']/);
assert.match(editor, /uiCard\.style\.setProperty\(\s*["']--preview-aspect-ratio["']/);
assert.match(editor, /function\s+syncCameraUiCardLayout/);
assert.match(editor, /card\.getBoundingClientRect\(\)\.height/);
assert.match(editor, /uiCard\.style\.height\s*=\s*`\$\{previewHeight\}px`/);
assert.match(editor, /syncCameraUiCardLayout\(card,\s*uiCard\)/);
assert.match(editor, /uiCard\.append\(depthCanvas\)/);
assert.match(editor, /cameraUiList\.append\(uiCard\)/);
assert.match(editor, /uiCard:\s*uiCard/);
assert.match(editor, /depthCanvas:\s*depthCanvas/);
assert.match(editor, /function\s+resizeCanvasBackingStore/);
assert.match(editor, /function\s+copyRendererToCanvas/);
assert.match(editor, /targetContext\.drawImage\(sourceRenderer\.domElement,\s*0,\s*0,\s*width,\s*height\)/);
assert.match(editor, /copyRendererToCanvas\(sharedPreviewRenderer,\s*preview\.canvas,\s*preview\.canvasContext,\s*preview\.width,\s*preview\.height\)/);
assert.match(editor, /copyRendererToCanvas\(sharedDepthRenderer,\s*preview\.depthCanvas,\s*preview\.depthContext,\s*preview\.width,\s*preview\.height\)/);
assert.doesNotMatch(editor, /renderer:\s*previewRenderer/);
assert.doesNotMatch(editor, /depthRenderer:\s*depthRenderer/);
assert.match(editor, /function\s+renderDepthPreview/);
assert.match(editor, /sharedDepthRenderer\.render\(scene,\s*preview\.camera\)/);
assert.match(editor, /try\s*\{[\s\S]*scene\.overrideMaterial\s*=\s*cameraDepthMaterial[\s\S]*\}\s*finally\s*\{[\s\S]*scene\.overrideMaterial\s*=\s*previousOverrideMaterial[\s\S]*scene\.background\s*=\s*previousBackground/);
assert.match(editor, /scene\.overrideMaterial\s*=\s*cameraDepthMaterial/);
assert.match(editor, /cameraDepthMaterial\.uniforms\.cameraNear\.value\s*=\s*preview\.camera\.near/);
assert.match(editor, /const\s+depthVisualizationRange\s*=\s*120/);
assert.match(editor, /const\s+depthVisualizationGamma\s*=\s*0\.65/);
assert.match(editor, /cameraDepthMaterial\.uniforms\.cameraFar\.value\s*=\s*Math\.min\(preview\.camera\.far,\s*depthVisualizationRange\)/);
assert.match(editor, /cameraDepthMaterial\.uniforms\.depthGamma\.value\s*=\s*depthVisualizationGamma/);
assert.doesNotMatch(editor, /cameraDepthMaterial\.uniforms\.cameraFar\.value\s*=\s*preview\.camera\.far/);
assert.match(editor, /float\s+linearDepth\s*=\s*clamp\(\(viewDepth\s*-\s*cameraNear\)\s*\/\s*max\(cameraFar\s*-\s*cameraNear,\s*0\.0001\),\s*0\.0,\s*1\.0\)/);
assert.match(editor, /float\s+depth\s*=\s*pow\(smoothstep\(0\.0,\s*1\.0,\s*linearDepth\),\s*depthGamma\)/);
assert.match(editor, /gl_FragColor\s*=\s*vec4\(vec3\(depth\),\s*1\.0\)/);
assert.match(editor, /card\.append\(previewCanvas,\s*createCameraPreviewGuideOverlay\(capturedCamera\)\)/);
assert.match(editor, /cameraGuideButtons\.forEach\(\(button\)\s*=>\s*\{/);
assert.match(editor, /toggleCameraGuideMode\(button\.dataset\.cameraGuide\)/);
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
assert.match(editor, /sharedPreviewRenderer\.render\(scene,\s*preview\.camera\)/);
assert.doesNotMatch(editor, /preview\.renderer\.render\(scene,\s*preview\.camera\)/);
assert.match(editor, /function\s+getPreviewRenderBounds/);
assert.match(editor, /const\s+cameraAspect\s*=\s*preview\.aspect\s*\?\?\s*preview\.camera\.aspect/);
assert.match(editor, /sharedPreviewRenderer\.setViewport\(/);
assert.match(editor, /sharedPreviewRenderer\.setScissor\(/);
assert.doesNotMatch(editor, /preview\.renderer\.setViewport\(/);
assert.doesNotMatch(editor, /preview\.renderer\.setScissor\(/);
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
  /function\s+render\(\)\s*\{[\s\S]*updateModelTransformPanel\(\);[\s\S]*flushSceneOutliner\(\);[\s\S]*renderSceneToActiveViewport\(\);[\s\S]*selectionOutline\.render\(selectedAsset,\s*selectionOutlineVisible\);[\s\S]*renderCapturedCameraPreviews\(\);[\s\S]*\}/,
  "The main render pass should only flush the scene outliner when dirty"
);
assert.match(editor, /function\s+getViewportBounds/);
assert.match(editor, /document\.querySelector\(\s*["']#left-ui-panel["']\s*\)/);
assert.match(editor, /document\.querySelector\(\s*["']#right-ui-panel["']\s*\)/);
assert.match(editor, /renderer\.setSize\(initialViewport\.width,\s*initialViewport\.height\)/);
assert.match(editor, /renderer\.shadowMap\.enabled\s*=\s*true/);
assert.match(editor, /renderer\.shadowMap\.type\s*=\s*THREE\.BasicShadowMap/);
assert.match(editor, /directionalLight\.shadow\.radius\s*=\s*0/);
assert.match(editor, /renderer\.setSize\(viewport\.width,\s*viewport\.height\)/);
assert.match(
  editor,
  /function\s+resize\(\)\s*\{[\s\S]*selectionOutline\.resize\(viewport\.width,\s*viewport\.height\);[\s\S]*resizeCapturedCameraPreviews\(\);[\s\S]*render\(\);[\s\S]*\}/,
  "Window resize should update captured camera preview renderers before rendering"
);
assert.match(editor, /cursorPosition:\s*\{\s*value:\s*new\s+THREE\.Vector2/);
assert.match(editor, /cellGridSize:\s*\{\s*value:\s*gridSnapSize/);
assert.match(editor, /sectionGridSize:\s*\{\s*value:\s*gridSnapSize\s*\*\s*2/);
assert.match(editor, /const\s+gridOriginLineWidth\s*=\s*0\.04/);
assert.match(editor, /const\s+gridOriginLineElevation\s*=\s*0\.004/);
assert.match(editor, /const\s+scaleSnapSize\s*=\s*1/);
assert.match(editor, /const\s+shadowReceiver\s*=\s*new\s+THREE\.Mesh\(/);
assert.match(editor, /new\s+THREE\.ShadowMaterial\(/);
assert.match(editor, /shadowReceiver\.receiveShadow\s*=\s*true/);
assert.match(editor, /shadowReceiver\.userData\.pickable\s*=\s*false/);
assert.match(editor, /const\s+gridOriginMaterial\s*=\s*new\s+THREE\.MeshBasicMaterial/);
assert.match(editor, /color:\s*0x5f6872/);
assert.match(editor, /opacity:\s*0\.45/);
assert.match(editor, /const\s+gridOriginXLine\s*=\s*new\s+THREE\.Mesh\(\s*new\s+THREE\.PlaneGeometry\(gridSize,\s*gridOriginLineWidth\)/);
assert.match(editor, /const\s+gridOriginYLine\s*=\s*new\s+THREE\.Mesh\(\s*new\s+THREE\.PlaneGeometry\(gridOriginLineWidth,\s*gridSize\)/);
assert.match(editor, /gridOriginXLine\.name\s*=\s*["']grid-origin-x-line["']/);
assert.match(editor, /gridOriginYLine\.name\s*=\s*["']grid-origin-y-line["']/);
assert.match(editor, /gridOriginXLine\.position\.z\s*=\s*gridOriginLineElevation/);
assert.match(editor, /gridOriginYLine\.position\.z\s*=\s*gridOriginLineElevation/);
assert.match(editor, /gridOriginXLine\.userData\.pickable\s*=\s*false/);
assert.match(editor, /gridOriginYLine\.userData\.pickable\s*=\s*false/);
assert.match(editor, /scene\.add\(gridOriginXLine,\s*gridOriginYLine\)/);
assert.match(editor, /transformControls\.setScaleSnap\(scaleSnapSize\)/);
assert.match(editor, /function\s+configureAssetShadows\(asset\)/);
assert.match(editor, /child\.castShadow\s*=\s*true/);
assert.match(editor, /child\.receiveShadow\s*=\s*false/);
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
