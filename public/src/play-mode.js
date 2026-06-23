import * as THREE from "three";

const defaultOptions = {
  cameraDistance: 6,
  cameraHeight: 1.8,
  cameraTargetHeight: 1.2,
  lookSensitivity: 0.0025,
  // Near-full vertical freedom (~ +84 / -80 degrees), like a third-person game.
  maxPitch: 1.47,
  minPitch: -1.4,
  moveSpeed: 4.5,
  shoulderOffset: 0.45,
  // Higher = snappier, lower = smoother. ~18 feels responsive yet damped.
  lookDamping: 18,
  captureCameraButton: 1
};

const movementKeys = new Set(["keyw", "keya", "keys", "keyd"]);

export function createPlayModeController({
  camera,
  renderer,
  render,
  onChange = () => {},
  onCaptureCamera = () => {},
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
  let yaw = 0;
  let pitch = 0.18;
  // Target angles accumulated from mouse input; the actual yaw/pitch eases toward
  // these every frame, which decouples smoothness from mouse-event frequency.
  let targetYaw = 0;
  let targetPitch = 0.18;

  function syncYawFromCamera() {
    camera.getWorldDirection(forward);

    if (forward.lengthSq() === 0) {
      yaw = 0;
      return;
    }

    yaw = Math.atan2(forward.y, forward.x);
    targetYaw = yaw;
  }

  function getGroundForward() {
    return forward.set(Math.cos(yaw), Math.sin(yaw), 0).normalize();
  }

  function getGroundRight() {
    return right.set(Math.sin(yaw), -Math.cos(yaw), 0).normalize();
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

  const canvas = renderer.domElement;

  function isPointerLocked() {
    return document.pointerLockElement === canvas;
  }

  function requestPointerLock() {
    if (!isPointerLocked() && canvas.requestPointerLock) {
      // Async; browsers may reject if not from a user gesture, that's fine.
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    }
  }

  function exitPointerLock() {
    if (isPointerLocked() && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  // When the lock is lost (mouse left, Esc, tab switch), drop all input so the
  // camera never gets a giant movementX/Y jump and never stays "stuck".
  function handlePointerLockChange() {
    if (playing && !isPointerLocked()) {
      keys.clear();
    }
  }

  document.addEventListener("pointerlockchange", handlePointerLockChange);

  function enter(character) {
    if (!character || character.userData.assetType !== "character") {
      return false;
    }

    player = character;
    playing = true;
    keys.clear();
    syncYawFromCamera();
    pitch = 0.18;
    targetYaw = yaw;
    targetPitch = pitch;
    renderer.domElement.focus();
    requestPointerLock();
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
    exitPointerLock();
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

  function handlePointerDown(event) {
    if (!playing) {
      return false;
    }

    event.preventDefault();
    renderer.domElement.focus();

    if (event.button === config.captureCameraButton) {
      onCaptureCamera();
      return true;
    }

    // Re-acquire the lock if it was lost (e.g. user pressed Esc then clicked back in).
    requestPointerLock();
    return true;
  }

  function handlePointerMove(event) {
    if (!playing) {
      return false;
    }

    // Only steer while pointer-locked. Without the lock, movementX/Y is unreliable
    // (huge jumps when the cursor re-enters the page), which is what made the
    // camera feel stuck.
    if (!isPointerLocked()) {
      return true;
    }

    event.preventDefault();

    // Guard against spurious large deltas (first event after lock, alt-tab, etc.).
    const maxDelta = 200;
    let dx = event.movementX || 0;
    let dy = event.movementY || 0;
    if (Math.abs(dx) > maxDelta || Math.abs(dy) > maxDelta) {
      return true;
    }

    if (dx === 0 && dy === 0) {
      return true;
    }

    // Accumulate into the TARGET angles only. The per-frame update() eases the
    // real camera toward these, giving smooth, frame-rate-independent rotation.
    targetYaw -= dx * config.lookSensitivity;
    targetPitch = THREE.MathUtils.clamp(
      targetPitch + dy * config.lookSensitivity,
      config.minPitch,
      config.maxPitch
    );
    return true;
  }

  function update(deltaTime) {
    if (!playing || !player) {
      return false;
    }

    // Exponential smoothing toward target angles (frame-rate independent).
    const t = 1 - Math.exp(-config.lookDamping * deltaTime);
    yaw += (targetYaw - yaw) * t;
    pitch += (targetPitch - pitch) * t;

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

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      player.position.addScaledVector(moveDirection, config.moveSpeed * deltaTime);
      player.rotation.z = Math.atan2(moveDirection.y, moveDirection.x) - Math.PI / 2;
    }

    // Always refresh the camera while playing so rotation keeps easing smoothly
    // every frame, independent of how often pointermove fires.
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
    handlePointerDown,
    handlePointerMove,
    isPlaying: () => playing,
    update
  };
}
