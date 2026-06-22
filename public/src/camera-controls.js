import * as THREE from "three";

const up = new THREE.Vector3(0, 0, 1);

export function createCameraController({
  camera,
  renderer,
  transformControls,
  getViewportPivot,
  getAssetAtEvent,
  pickAsset,
  render,
  updateSelectionFeedback,
  isNavigationBlocked,
  isTransformDragging,
  onMoveSpeedChange = () => {}
}) {
  const keys = new Set();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const viewUp = new THREE.Vector3();
  const lookDirection = new THREE.Vector3();
  const orbitOffset = new THREE.Vector3();
  const panDelta = new THREE.Vector3();
  const mouseButtons = {
    left: false,
    middle: false,
    right: false
  };
  const dragThreshold = 4;
  const lookSensitivity = 0.003;
  const orbitSensitivity = 0.005;
  const lmbDollyScale = 0.012;
  const minCameraMoveSpeed = 1;
  const maxCameraMoveSpeed = 80;

  let cameraDragState = null;
  let pendingClick = null;
  let cameraMoveSpeed = 7;
  let yaw = 0;
  let pitch = 0;

  function setMoveSpeed(value) {
    const numericSpeed = Number(value);

    if (!Number.isFinite(numericSpeed)) {
      return cameraMoveSpeed;
    }

    cameraMoveSpeed = THREE.MathUtils.clamp(
      numericSpeed,
      minCameraMoveSpeed,
      maxCameraMoveSpeed
    );
    onMoveSpeedChange(cameraMoveSpeed);
    return cameraMoveSpeed;
  }

  function syncRotationFromCamera() {
    camera.getWorldDirection(forward);
    yaw = Math.atan2(forward.y, forward.x);
    pitch = Math.asin(THREE.MathUtils.clamp(forward.z, -1, 1));
  }

  function updateCameraRotation() {
    lookDirection.set(
      Math.cos(pitch) * Math.cos(yaw),
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch)
    );
    camera.lookAt(camera.position.clone().add(lookDirection));
  }

  function moveCamera(distance) {
    camera.getWorldDirection(forward);
    camera.position.addScaledVector(forward, distance);
  }

  function updateCameraAxes() {
    camera.getWorldDirection(forward).normalize();
    right.crossVectors(forward, up);

    if (right.lengthSq() === 0) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    viewUp.crossVectors(right, forward).normalize();
  }

  function syncMouseButtons(event) {
    mouseButtons.left = (event.buttons & 1) !== 0;
    mouseButtons.right = (event.buttons & 2) !== 0;
    mouseButtons.middle = (event.buttons & 4) !== 0;
  }

  function setPointerCapture(event) {
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
    }
  }

  function releasePointerCapture(pointerId) {
    try {
      if (renderer.domElement.hasPointerCapture(pointerId)) {
        renderer.domElement.releasePointerCapture(pointerId);
      }
    } catch {
    }
  }

  function getCameraDragScale(target) {
    const distance = target ? camera.position.distanceTo(target) : Math.max(camera.position.length(), 10);
    return Math.max(distance * 0.002, 0.006);
  }

  function panCamera(dx, dy, target = null) {
    updateCameraAxes();
    const scale = getCameraDragScale(target);

    panDelta.set(0, 0, 0);
    panDelta.addScaledVector(right, dx * scale);
    panDelta.addScaledVector(viewUp, -dy * scale);
    camera.position.add(panDelta);

    if (target) {
      target.add(panDelta);
    }
  }

  function setCameraDragCursor(mode) {
    renderer.domElement.style.cursor = mode === "look" ? "none" : "grabbing";
  }

  function beginCameraDrag(mode, event, target = null) {
    const state = {
      mode,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      target
    };

    if (target && (mode === "orbit" || mode === "alt-dolly")) {
      const offset = orbitOffset.copy(camera.position).sub(target);
      const distance = Math.max(offset.length(), 0.001);

      state.distance = distance;
      state.yaw = Math.atan2(offset.y, offset.x);
      state.elevation = Math.asin(THREE.MathUtils.clamp(offset.z / distance, -1, 1));
    }

    cameraDragState = state;
    pendingClick = null;
    transformControls.enabled = false;
    renderer.domElement.focus();
    setPointerCapture(event);
    setCameraDragCursor(mode);
  }

  function finishCameraDrag(event) {
    if (!cameraDragState) {
      return;
    }

    releasePointerCapture(cameraDragState.pointerId);
    cameraDragState = null;
    updateSelectionFeedback();
    renderer.domElement.style.cursor = "default";

    if (event) {
      event.preventDefault();
    }
  }

  function cameraDragShouldEnd() {
    if (!cameraDragState) {
      return false;
    }

    if (cameraDragState.mode === "look" || cameraDragState.mode === "alt-dolly") {
      return !mouseButtons.right;
    }

    if (cameraDragState.mode === "lmb-dolly-yaw" || cameraDragState.mode === "orbit") {
      return !mouseButtons.left;
    }

    if (cameraDragState.mode === "alt-track") {
      return !mouseButtons.middle;
    }

    return !(mouseButtons.middle || (mouseButtons.left && mouseButtons.right));
  }

  function updateCameraLook(dx, dy) {
    yaw -= dx * lookSensitivity;
    pitch -= dy * lookSensitivity;
    pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    updateCameraRotation();
  }

  function updateOrbitDrag(state, dx, dy) {
    state.yaw -= dx * orbitSensitivity;
    state.elevation += dy * orbitSensitivity;
    state.elevation = THREE.MathUtils.clamp(
      state.elevation,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );

    const radiusOnGround = Math.cos(state.elevation) * state.distance;

    orbitOffset.set(
      Math.cos(state.yaw) * radiusOnGround,
      Math.sin(state.yaw) * radiusOnGround,
      Math.sin(state.elevation) * state.distance
    );
    camera.position.copy(state.target).add(orbitOffset);
    camera.lookAt(state.target);
    syncRotationFromCamera();
  }

  function updateAltDollyDrag(state, dy) {
    state.distance = Math.max(0.35, state.distance + dy * state.distance * 0.01);
    orbitOffset.copy(camera.position).sub(state.target).normalize().multiplyScalar(state.distance);
    camera.position.copy(state.target).add(orbitOffset);
    camera.lookAt(state.target);
    syncRotationFromCamera();
  }

  function updateCameraDrag(event) {
    if (!cameraDragState || event.pointerId !== cameraDragState.pointerId) {
      return false;
    }

    const dx = event.clientX - cameraDragState.lastX;
    const dy = event.clientY - cameraDragState.lastY;

    cameraDragState.lastX = event.clientX;
    cameraDragState.lastY = event.clientY;

    if (dx === 0 && dy === 0) {
      return true;
    }

    if (cameraDragState.mode === "look") {
      updateCameraLook(dx, dy);
    } else if (cameraDragState.mode === "lmb-dolly-yaw") {
      yaw -= dx * lookSensitivity;
      updateCameraRotation();
      moveCamera(-dy * cameraMoveSpeed * lmbDollyScale);
    } else if (cameraDragState.mode === "pan") {
      panCamera(dx, dy);
    } else if (cameraDragState.mode === "orbit") {
      updateOrbitDrag(cameraDragState, dx, dy);
    } else if (cameraDragState.mode === "alt-dolly") {
      updateAltDollyDrag(cameraDragState, dy);
    } else if (cameraDragState.mode === "alt-track") {
      panCamera(dx, dy, cameraDragState.target);
    }

    render();
    return true;
  }

  function maybeStartPendingLeftDrag(event) {
    if (!pendingClick || event.pointerId !== pendingClick.pointerId) {
      return false;
    }

    if (pendingClick.asset) {
      return false;
    }

    if (mouseButtons.right || mouseButtons.middle) {
      beginCameraDrag("pan", event);
      return true;
    }

    const dx = event.clientX - pendingClick.x;
    const dy = event.clientY - pendingClick.y;

    if (Math.hypot(dx, dy) < dragThreshold) {
      return false;
    }

    beginCameraDrag("lmb-dolly-yaw", event);
    return true;
  }

  function handlePointerDown(event) {
    if (isNavigationBlocked() || event.button < 0 || event.button > 2) {
      return;
    }

    syncMouseButtons(event);
    renderer.domElement.focus();
    setPointerCapture(event);

    if (event.altKey) {
      const target = getViewportPivot(event);

      if (event.button === 0) {
        beginCameraDrag("orbit", event, target);
      } else if (event.button === 1) {
        beginCameraDrag("alt-track", event, target);
      } else if (event.button === 2) {
        beginCameraDrag("alt-dolly", event, target);
      }

      event.preventDefault();
      return;
    }

    if (mouseButtons.middle || (mouseButtons.left && mouseButtons.right)) {
      beginCameraDrag("pan", event);
      event.preventDefault();
      return;
    }

    if (event.button === 2) {
      beginCameraDrag("look", event);
      event.preventDefault();
      return;
    }

    if (event.button === 0) {
      pendingClick = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        asset: getAssetAtEvent(event)
      };
    }
  }

  function handlePointerMove(event) {
    syncMouseButtons(event);

    if (isNavigationBlocked()) {
      return;
    }

    if (cameraDragState) {
      event.preventDefault();
      updateCameraDrag(event);

      if (cameraDragShouldEnd()) {
        finishCameraDrag(event);
      }

      return;
    }

    if (maybeStartPendingLeftDrag(event)) {
      event.preventDefault();
    }
  }

  function handlePointerUp(event) {
    syncMouseButtons(event);

    if (cameraDragState) {
      if (cameraDragShouldEnd() || event.type === "pointercancel") {
        finishCameraDrag(event);
      }

      return;
    }

    if (pendingClick && event.button === 0 && event.pointerId === pendingClick.pointerId) {
      const pendingAsset = pendingClick.asset;

      pendingClick = null;
      pickAsset(event, pendingAsset);
    }

    if (!mouseButtons.left && !mouseButtons.middle && !mouseButtons.right) {
      pendingClick = null;
      releasePointerCapture(event.pointerId);
    }
  }

  function updateMovement(deltaTime) {
    if (!mouseButtons.right || keys.size === 0 || isTransformDragging()) {
      return false;
    }

    const speed = keys.has("shiftleft") || keys.has("shiftright")
      ? cameraMoveSpeed * 2.5
      : cameraMoveSpeed;
    const distance = speed * deltaTime;
    let moved = false;

    updateCameraAxes();

    if (keys.has("keyw")) {
      camera.position.addScaledVector(forward, distance);
      moved = true;
    }

    if (keys.has("keys")) {
      camera.position.addScaledVector(forward, -distance);
      moved = true;
    }

    if (keys.has("keyd")) {
      camera.position.addScaledVector(right, distance);
      moved = true;
    }

    if (keys.has("keya")) {
      camera.position.addScaledVector(right, -distance);
      moved = true;
    }

    if (keys.has("keye")) {
      camera.position.z += distance;
      moved = true;
    }

    if (keys.has("keyq")) {
      camera.position.z -= distance;
      moved = true;
    }

    return moved;
  }

  function zoomView(event) {
    event.preventDefault();

    if (mouseButtons.right) {
      const speedScale = event.deltaY < 0 ? 1.12 : 0.88;

      setMoveSpeed(cameraMoveSpeed * speedScale);
      return;
    }

    moveCamera(-event.deltaY * 0.02);
    render();
  }

  function pressKey(code) {
    keys.add(code);
  }

  function releaseKey(event) {
    keys.delete(event.code.toLowerCase());
  }

  function clearState() {
    keys.clear();
    mouseButtons.left = false;
    mouseButtons.middle = false;
    mouseButtons.right = false;
    pendingClick = null;
    finishCameraDrag();
  }

  return {
    clearState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getMoveSpeed: () => cameraMoveSpeed,
    isDragging: () => Boolean(cameraDragState),
    isRightButtonDown: () => mouseButtons.right,
    pressKey,
    releaseKey,
    setMoveSpeed,
    syncRotationFromCamera,
    updateMovement,
    zoomView
  };
}
