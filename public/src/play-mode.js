import * as THREE from "three";

const defaultOptions = {
  cameraDistance: 6,
  cameraHeight: 1.8,
  cameraTargetHeight: 1.2,
  lookSensitivity: 0.003,
  maxPitch: 0.55,
  minPitch: -0.35,
  moveSpeed: 4.5,
  shoulderOffset: 0.45,
  captureCameraKey: "keyc"
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

  function syncYawFromCamera() {
    camera.getWorldDirection(forward);

    if (forward.lengthSq() === 0) {
      yaw = 0;
      return;
    }

    yaw = Math.atan2(forward.y, forward.x);
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

  function enter(character) {
    if (!character || character.userData.assetType !== "character") {
      return false;
    }

    player = character;
    playing = true;
    keys.clear();
    syncYawFromCamera();
    pitch = 0.18;
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

    if (code === config.captureCameraKey) {
      onCaptureCamera();
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
      pitch + dy * config.lookSensitivity,
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
    handlePointerDown,
    handlePointerMove,
    isPlaying: () => playing,
    update
  };
}
