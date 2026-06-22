import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const playMode = readFileSync(join(root, "public/src/play-mode.js"), "utf8");
const editor = readFileSync(join(root, "public/src/editor.js"), "utf8");

assert.match(
  playMode,
  /function\s+getGroundRight\(\)\s*\{\s*return\s+right\.set\(Math\.sin\(yaw\),\s*-Math\.cos\(yaw\),\s*0\)\.normalize\(\);\s*\}/s,
  "D movement should use the camera-space right vector for a Z-up scene"
);

assert.match(
  playMode,
  /pitch\s*=\s*THREE\.MathUtils\.clamp\(\s*pitch\s*\+\s*dy\s*\*\s*config\.lookSensitivity,/s,
  "Mouse Y movement should map to the non-inverted third-person pitch direction"
);

assert.doesNotMatch(
  playMode,
  /requestPointerLock/,
  "Play mode should not request pointer lock when the cursor should remain visible"
);

assert.doesNotMatch(
  playMode,
  /exitPointerLock/,
  "Play mode should not release pointer lock because it no longer requests it"
);

assert.doesNotMatch(
  playMode,
  /style\.cursor\s*=\s*["']none["']/,
  "Play mode should not hide the mouse cursor"
);

assert.match(
  playMode,
  /captureCameraKey:\s*["']keyc["']/,
  "C should be the runtime shortcut for capturing the current player camera"
);

assert.match(
  playMode,
  /onCaptureCamera\s*=\s*\(\)\s*=>\s*\{\}/,
  "Play mode should accept a capture-camera callback"
);

assert.match(
  playMode,
  /code\s*===\s*config\.captureCameraKey[\s\S]*onCaptureCamera\(\)/,
  "Pressing the capture shortcut while playing should invoke the capture callback"
);

assert.match(
  playMode,
  /function\s+handlePointerDown\(event\)/,
  "Play mode should retry pointer lock from a viewport click"
);

assert.match(
  playMode,
  /handlePointerDown,[\s\S]*handlePointerMove,/,
  "The pointer down handler should be exposed by the play mode controller"
);

assert.match(
  editor,
  /playMode\.handlePointerDown\(event\)/,
  "The editor should forward viewport pointer down events to play mode"
);
