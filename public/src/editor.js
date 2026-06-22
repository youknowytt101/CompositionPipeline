import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { createAsset, getAssetGridOffset } from "./assets.js";
import { createCameraController } from "./camera-controls.js";
import { createPlayModeController } from "./play-mode.js";
import { createSelectionOutline } from "./selection-outline.js";

const TRANSFORM_MODE_KEYS = {
  keyw: "translate",
  keye: "rotate",
  keyr: "scale"
};

const DEFAULT_CAMERA_SETTINGS = {
  fov: 60,
  runtimeAspectPreset: "16:9",
  runtimeAspectWidth: 16,
  runtimeAspectHeight: 9
};

const minCameraFov = 20;
const maxCameraFov = 100;

export function createEditor() {
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
  const initialViewport = getViewportBounds();
  const cameraSettings = { ...DEFAULT_CAMERA_SETTINGS };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(
    cameraSettings.fov,
    initialViewport.width / initialViewport.height,
    0.1,
    2000
  );
  camera.up.set(0, 0, 1);
  camera.position.set(10, -16, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialViewport.width, initialViewport.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.left = `${initialViewport.left}px`;
  renderer.domElement.style.top = `${initialViewport.top}px`;
  renderer.domElement.tabIndex = 0;
  document.body.appendChild(renderer.domElement);

  const selectionOutline = createSelectionOutline(renderer, camera);

  const ambientLight = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
  directionalLight.position.set(8, 14, 10);
  scene.add(directionalLight);

  const gridSize = 500;
  const gridSnapSize = 1;
  const scaleSnapSize = 1;
  const gridHalfSize = gridSize / 2;
  const gridMaterial = new THREE.ShaderMaterial({
    extensions: {
      derivatives: true
    },
    uniforms: {
      cursorPosition: { value: new THREE.Vector2(0, 0) },
      cellGridSize: { value: gridSnapSize },
      sectionGridSize: { value: gridSnapSize * 2 },
      cellColor: { value: new THREE.Color(0xc4c9cf) },
      sectionColor: { value: new THREE.Color(0x7f8790) },
      fadeDistance: { value: gridSize / 2 },
      fadeStrength: { value: 1.35 },
      cursorRevealRadius: { value: 18 },
      baseVisibility: { value: 0.24 }
    },
    vertexShader: `
      varying vec3 worldPosition;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = modelViewMatrix * vec4(position, 1.0);

        worldPosition = world.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec2 cursorPosition;
      uniform float cellGridSize;
      uniform float sectionGridSize;
      uniform vec3 cellColor;
      uniform vec3 sectionColor;
      uniform float fadeDistance;
      uniform float fadeStrength;
      uniform float cursorRevealRadius;
      uniform float baseVisibility;

      varying vec3 worldPosition;

      float gridLine(vec2 coord) {
        vec2 derivative = max(fwidth(coord), vec2(0.0001));
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / derivative;
        float line = min(grid.x, grid.y);
        return 1.0 - smoothstep(0.0, 0.62, line);
      }

      float screenDensityFade(vec2 coord) {
        vec2 derivative = fwidth(coord);
        float density = max(derivative.x, derivative.y);
        return 1.0 - smoothstep(0.45, 1.0, density);
      }

      void main() {
        vec2 position = worldPosition.xy;
        vec2 cellCoord = position / cellGridSize;
        vec2 sectionCoord = position / sectionGridSize;

        float cellLine = gridLine(cellCoord) * screenDensityFade(cellCoord);
        float sectionLine = gridLine(sectionCoord) * screenDensityFade(sectionCoord);
        float edgeFade = pow(
          1.0 - clamp(length(position) / fadeDistance, 0.0, 1.0),
          fadeStrength
        );
        float cursorDistance = distance(position, cursorPosition);
        float cursorFade = 1.0 - smoothstep(0.0, cursorRevealRadius, cursorDistance);
        float visibility = max(baseVisibility, cursorFade);
        float alpha = max(cellLine * 0.34, sectionLine * 0.68) * edgeFade * visibility;
        vec3 gridColor = mix(cellColor, sectionColor, sectionLine);

        gl_FragColor = vec4(gridColor, clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true
  });
  const shadowReceiver = new THREE.Mesh(
    new THREE.PlaneGeometry(gridSize, gridSize, 1, 1),
    new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.24,
      transparent: true
    })
  );

  shadowReceiver.name = "ground-shadow-receiver";
  shadowReceiver.position.z = -0.01;
  shadowReceiver.receiveShadow = true;
  shadowReceiver.userData.pickable = false;
  scene.add(shadowReceiver);

  const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
  const grid = new THREE.Mesh(gridGeometry, gridMaterial);
  scene.add(grid);

  const assetToolbar = document.querySelector("#asset-toolbar");
  const transformToolbar = document.querySelector("#transform-toolbar");
  const transformButtons = Array.from(document.querySelectorAll("[data-transform-mode]"));
  const runButton = document.querySelector('[data-system-tool="run"]');
  const roadButton = document.querySelector('[data-system-tool="road"]');
  const rightPanelToggleButton = document.querySelector("#right-panel-toggle");
  const playViewportFrame = document.querySelector("#play-viewport-frame");
  const fovRange = document.querySelector("#camera-fov-range");
  const fovValue = document.querySelector("#camera-fov-value");
  const runtimeAspectValue = document.querySelector("#runtime-aspect-value");
  const cameraSpeedInput = document.querySelector("#camera-speed-input");
  const aspectPresetButtons = Array.from(document.querySelectorAll("[data-aspect-preset]"));
  const cameraPreviewList = document.querySelector("#camera-preview-list");
  const dragPreview = document.querySelector("#drag-preview");
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const groundPoint = new THREE.Vector3();
  const capturedCameraPreviews = [];
  const placedAssets = [];
  const roadTiles = new Map();
  const forward = new THREE.Vector3();
  const cubeSizeMeters = 1;
  const defaultAssetColor = 0xd8d8d8;
  const rotationSnapAngle = THREE.MathUtils.degToRad(15);

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
  let rightPanelCollapsed = false;
  let roadDrawingMode = false;
  let roadDrawing = false;
  const undoStack = [];

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode("translate");
  transformControls.setSpace("world");
  transformControls.setSize(0.85);
  transformControls.setTranslationSnap(null);
  transformControls.setRotationSnap(rotationSnapAngle);
  transformControls.setScaleSnap(scaleSnapSize);
  scene.add(transformControls);

  transformControls.addEventListener("change", render);
  transformControls.addEventListener("objectChange", () => {
    if (selectedAsset && activeTransformMode === "translate") {
      snapAssetPosition(selectedAsset);
    }

    render();
  });
  transformControls.addEventListener("mouseDown", () => {
    isTransformDragging = true;
    duplicatedTransformAsset = duplicateOnTransformDrag && selectedAsset
      ? duplicateAssetForTransform(selectedAsset)
      : null;
    duplicateOnTransformDrag = false;
    transformStart = selectedAsset ? captureTransform(selectedAsset) : null;
  });
  transformControls.addEventListener("mouseUp", () => {
    isTransformDragging = false;

    if (duplicatedTransformAsset) {
      pushUndo({
        type: "duplicate",
        asset: duplicatedTransformAsset
      });
    } else if (selectedAsset && transformStart) {
      const transformEnd = captureTransform(selectedAsset);

      if (!transformsMatch(transformStart, transformEnd)) {
        pushUndo({
          type: "transform",
          asset: selectedAsset,
          before: transformStart,
          after: transformEnd
        });
      }
    }

    duplicatedTransformAsset = null;
    transformStart = null;
  });
  transformControls.addEventListener("dragging-changed", (event) => {
    isTransformDragging = event.value;
  });

  cameraControls = createCameraController({
    camera,
    renderer,
    transformControls,
    getViewportPivot,
    getAssetAtEvent,
    pickAsset,
    render,
    updateSelectionFeedback,
    isNavigationBlocked: () => isPlayModeActive() || dragState || isTransformDragging || transformControls.dragging,
    isTransformDragging: () => isTransformDragging,
    onMoveSpeedChange: updateCameraSpeedControl
  });

  playMode = createPlayModeController({
    camera,
    renderer,
    render,
    onCaptureCamera: capturePlayerCamera,
    onChange: updatePlayModeFeedback
  });

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

    document.body.classList.toggle("is-playing", playing);
    runButton?.classList.toggle("is-active", playing);
    transformToolbar.hidden = playing || !selectedAsset;
    updateSelectionFeedback();
    render();

    if (playing) {
      renderer.domElement.focus();
    } else {
      cameraControls.syncRotationFromCamera();
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

  function parseAspectPreset(preset) {
    const [width, height] = `${preset}`.split(":").map(Number);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      return null;
    }

    return { width, height };
  }

  function updateAspectControls() {
    const label = getAspectLabel();

    if (runtimeAspectValue) {
      runtimeAspectValue.textContent = label;
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
    updateCameraSpeedControl();
  }

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

  function updateCameraSpeedControl(value = cameraControls?.getMoveSpeed?.()) {
    const speed = Number(value);

    if (!cameraSpeedInput || !Number.isFinite(speed)) {
      return;
    }

    cameraSpeedInput.value = `${Math.round(speed * 10) / 10}`;
  }

  function setCameraMoveSpeed(value) {
    const speed = cameraControls.setMoveSpeed(value);

    updateCameraSpeedControl(speed);
  }

  function setRightPanelCollapsed(collapsed) {
    rightPanelCollapsed = Boolean(collapsed);
    document.body.classList.toggle("is-right-panel-collapsed", rightPanelCollapsed);
    rightPanelToggleButton?.setAttribute("aria-expanded", `${!rightPanelCollapsed}`);

    if (rightPanelToggleButton) {
      rightPanelToggleButton.name = rightPanelCollapsed ? "chevron-left" : "chevron-right";
      rightPanelToggleButton.label = rightPanelCollapsed ? "Expand right panel" : "Collapse right panel";
    }

    requestAnimationFrame(resize);
  }

  function getRoadCellFromPoint(point) {
    return {
      x: Math.floor(point.x / gridSnapSize),
      y: Math.floor(point.y / gridSnapSize)
    };
  }

  function paintRoadAtPoint(point) {
    const cell = getRoadCellFromPoint(point);
    const key = `${cell.x}:${cell.y}`;

    if (roadTiles.has(key)) {
      return false;
    }

    const roadTile = new THREE.Mesh(
      new THREE.PlaneGeometry(gridSnapSize, gridSnapSize),
      new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    );

    roadTile.position.set(
      (cell.x + 0.5) * gridSnapSize,
      (cell.y + 0.5) * gridSnapSize,
      0.02
    );
    roadTile.userData.pickable = false;
    scene.add(roadTile);
    roadTiles.set(key, roadTile);
    render();
    return true;
  }

  function setRoadDrawingMode(active) {
    roadDrawingMode = Boolean(active);
    roadButton?.classList.toggle("is-active", roadDrawingMode);
    roadDrawing = false;
  }

  function beginRoadDrawing(event) {
    if (!roadDrawingMode || isPlayModeActive() || event.button !== 0) {
      return false;
    }

    const point = getGroundPoint(event.clientX, event.clientY);

    if (!point) {
      return false;
    }

    event.preventDefault();
    roadDrawing = true;
    paintRoadAtPoint(point);
    return true;
  }

  function continueRoadDrawing(event) {
    if (!roadDrawing) {
      return false;
    }

    const point = getGroundPoint(event.clientX, event.clientY);

    event.preventDefault();

    if (point) {
      paintRoadAtPoint(point);
    }

    return true;
  }

  function endRoadDrawing() {
    roadDrawing = false;
  }

  function copyCameraState(targetCamera, sourceCamera) {
    targetCamera.position.copy(sourceCamera.position);
    targetCamera.quaternion.copy(sourceCamera.quaternion);
    targetCamera.up.copy(sourceCamera.up);
    targetCamera.fov = sourceCamera.fov;
    targetCamera.aspect = sourceCamera.aspect;
    targetCamera.near = sourceCamera.near;
    targetCamera.far = sourceCamera.far;
    targetCamera.updateProjectionMatrix();
    targetCamera.updateMatrixWorld(true);
  }

  function configureAssetShadows(asset) {
    asset.traverse((child) => {
      if (!child.isMesh || child.userData.lightHelper) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  function syncSunLightDirection(asset) {
    if (asset.userData.assetType !== "sun-light") {
      return;
    }

    const light = asset.userData.sunLight;
    const target = asset.userData.sunLightTarget;

    if (!light || !target) {
      return;
    }

    asset.updateMatrixWorld(true);
    light.updateMatrixWorld(true);
    target.updateMatrixWorld(true);
  }

  function syncSceneLights() {
    placedAssets.forEach(syncSunLightDirection);
  }

  function resizeCapturedCameraPreview(preview) {
    const rect = preview.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    preview.width = width;
    preview.height = height;
    preview.renderer.setSize(width, height, false);
  }

  function resizeCapturedCameraPreviews() {
    capturedCameraPreviews.forEach(resizeCapturedCameraPreview);
  }

  function getPreviewRenderBounds(preview) {
    const canvasWidth = Math.max(1, preview.width ?? preview.canvas.width);
    const canvasHeight = Math.max(1, preview.height ?? preview.canvas.height);
    const cameraAspect = preview.aspect ?? preview.camera.aspect;
    let width = canvasWidth;
    let height = Math.round(width / cameraAspect);

    if (height > canvasHeight) {
      height = canvasHeight;
      width = Math.round(height * cameraAspect);
    }

    return {
      left: Math.floor((canvasWidth - width) / 2),
      bottom: Math.floor((canvasHeight - height) / 2),
      width: Math.max(1, width),
      height: Math.max(1, height)
    };
  }

  function renderCapturedCameraPreviews() {
    if (capturedCameraPreviews.length === 0) {
      return;
    }

    const transformControlsVisible = transformControls.visible;

    transformControls.visible = false;
    capturedCameraPreviews.forEach((preview) => {
      resizeCapturedCameraPreview(preview);
      const previewBounds = getPreviewRenderBounds(preview);

      preview.renderer.setScissorTest(false);
      preview.renderer.setViewport(0, 0, preview.width, preview.height);
      preview.renderer.clear();
      preview.renderer.setViewport(
        previewBounds.left,
        previewBounds.bottom,
        previewBounds.width,
        previewBounds.height
      );
      preview.renderer.setScissor(
        previewBounds.left,
        previewBounds.bottom,
        previewBounds.width,
        previewBounds.height
      );
      preview.renderer.setScissorTest(true);
      preview.renderer.render(scene, preview.camera);
      preview.renderer.setScissorTest(false);
    });
    transformControls.visible = transformControlsVisible;
  }

  function capturePlayerCamera() {
    if (!isPlayModeActive() || !cameraPreviewList) {
      return false;
    }

    syncCameraProjection();
    const capturedAspect = camera.aspect;

    const capturedCamera = new THREE.PerspectiveCamera(
      camera.fov,
      capturedAspect,
      camera.near,
      camera.far
    );
    const card = document.createElement("div");
    const previewCanvas = document.createElement("canvas");
    const previewRenderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: previewCanvas,
      preserveDrawingBuffer: true
    });

    copyCameraState(capturedCamera, camera);

    card.className = "camera-preview-card";
    card.style.setProperty("--preview-aspect-ratio", `${capturedAspect}`);
    card.append(previewCanvas);
    cameraPreviewList.append(card);

    scene.add(capturedCamera);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
    previewRenderer.shadowMap.type = renderer.shadowMap.type;
    previewRenderer.setClearColor(0x2b2b2b, 1);

    capturedCameraPreviews.push({
      aspect: capturedAspect,
      camera: capturedCamera,
      canvas: previewCanvas,
      width: 1,
      height: 1,
      renderer: previewRenderer
    });
    render();
    return true;
  }

  function markAsset(asset, type) {
    const id = `${type}-${nextAssetId}`;
    nextAssetId += 1;

    asset.name = id;
    asset.userData.assetRoot = asset;
    asset.userData.assetId = id;
    asset.userData.assetType = type;

    asset.traverse((child) => {
      child.userData.assetRoot = asset;
      child.userData.assetId = id;
      child.userData.assetType = type;
    });

    configureAssetShadows(asset);
    placedAssets.push(asset);
    return asset;
  }

  function captureTransform(asset) {
    return {
      position: asset.position.clone(),
      quaternion: asset.quaternion.clone(),
      scale: asset.scale.clone()
    };
  }

  function applyTransform(asset, transform) {
    asset.position.copy(transform.position);
    asset.quaternion.copy(transform.quaternion);
    asset.scale.copy(transform.scale);
    asset.updateMatrixWorld(true);
  }

  function duplicateAssetForTransform(sourceAsset) {
    const type = sourceAsset.userData.assetType;
    const duplicate = markAsset(createAsset(type, { cubeSizeMeters, defaultAssetColor }), type);

    applyTransform(duplicate, captureTransform(sourceAsset));
    scene.add(duplicate);
    selectAsset(duplicate);
    return duplicate;
  }

  function transformsMatch(first, second) {
    return (
      first.position.equals(second.position) &&
      first.quaternion.equals(second.quaternion) &&
      first.scale.equals(second.scale)
    );
  }

  function pushUndo(action) {
    undoStack.push(action);

    if (undoStack.length > 100) {
      undoStack.shift();
    }
  }

  function removeAsset(asset) {
    const index = placedAssets.indexOf(asset);

    if (index !== -1) {
      placedAssets.splice(index, 1);
    }

    scene.remove(asset);

    if (selectedAsset === asset) {
      selectAsset(null);
    }

    return index;
  }

  function restoreAsset(asset, index) {
    if (!placedAssets.includes(asset)) {
      const safeIndex = THREE.MathUtils.clamp(index, 0, placedAssets.length);
      placedAssets.splice(safeIndex, 0, asset);
    }

    if (!asset.parent) {
      scene.add(asset);
    }

    selectAsset(asset);
  }

  function snapToGrid(value, offset = 0) {
    return Math.round((value - offset) / gridSnapSize) * gridSnapSize + offset;
  }

  function snapAssetPosition(asset) {
    const gridOffset = getAssetGridOffset(asset, { cubeSizeMeters });

    asset.position.x = snapToGrid(asset.position.x, gridOffset);
    asset.position.y = snapToGrid(asset.position.y, gridOffset);
    asset.position.z = snapToGrid(asset.position.z);
  }

  function placeAsset(type, point) {
    const asset = markAsset(createAsset(type, { cubeSizeMeters, defaultAssetColor }), type);
    asset.position.set(point.x, point.y, 0);
    snapAssetPosition(asset);
    scene.add(asset);
    selectAsset(asset);
    pushUndo({ type: "create", asset });
    render();
  }

  function deleteSelectedAsset() {
    if (!selectedAsset || isPlayModeActive() || isTransformDragging || cameraControls.isDragging()) {
      return false;
    }

    const asset = selectedAsset;
    const index = placedAssets.indexOf(asset);

    if (index === -1) {
      return false;
    }

    removeAsset(asset);
    pushUndo({ type: "delete", asset, index });
    render();
    return true;
  }

  function undoLastAction() {
    const action = undoStack.pop();

    if (!action) {
      return false;
    }

    if (action.type === "create") {
      removeAsset(action.asset);
      render();
      return true;
    }

    if (action.type === "duplicate") {
      removeAsset(action.asset);
      render();
      return true;
    }

    if (action.type === "delete") {
      restoreAsset(action.asset, action.index);
      render();
      return true;
    }

    if (action.type === "transform") {
      if (!placedAssets.includes(action.asset)) {
        return true;
      }

      applyTransform(action.asset, action.before);
      selectAsset(action.asset);
      render();
      return true;
    }

    return false;
  }

  function setTransformMode(mode) {
    activeTransformMode = mode;
    transformControls.setMode(mode);
    transformButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.transformMode === mode);
    });
    render();
  }

  function rebuildSelectionOutlineMask() {
    selectionOutline.rebuild(selectedAsset, selectionOutlineVisible && !isPlayModeActive());
  }

  function updateSelectionFeedback() {
    const hasSelection = Boolean(selectedAsset);
    const playing = isPlayModeActive();
    const showTransform = hasSelection && transformGizmoVisible && !playing;

    transformControls.visible = showTransform;
    transformControls.enabled = showTransform && !cameraControls.isDragging();
    rebuildSelectionOutlineMask();
  }

  function selectAsset(asset) {
    selectedAsset = asset;
    transformToolbar.hidden = !selectedAsset || isPlayModeActive();

    if (selectedAsset) {
      transformControls.attach(selectedAsset);
    } else {
      transformControls.detach();
    }

    updateSelectionFeedback();
    render();
  }

  function getCanvasPoint(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();

    return {
      rect,
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  function getPointerFromEvent(event) {
    const canvasPoint = getCanvasPoint(event.clientX, event.clientY);

    pointer.set(canvasPoint.x, canvasPoint.y);
  }

  function getTransformPointerFromEvent(event) {
    const canvasPoint = getCanvasPoint(event.clientX, event.clientY);

    return {
      x: canvasPoint.x,
      y: canvasPoint.y,
      button: event.button
    };
  }

  function prepareTransformDuplicate(event) {
    duplicateOnTransformDrag = false;

    if (
      isPlayModeActive() ||
      event.button !== 0 ||
      !event.altKey ||
      roadDrawingMode ||
      roadDrawing ||
      !selectedAsset ||
      !transformGizmoVisible ||
      !transformControls.visible ||
      !transformControls.enabled ||
      cameraControls.isDragging() ||
      dragState
    ) {
      return;
    }

    transformControls.updateMatrixWorld(true);
    transformControls.pointerHover(getTransformPointerFromEvent(event));
    duplicateOnTransformDrag = transformControls.axis !== null;
  }

  function getAssetAtEvent(event) {
    getPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(placedAssets, true);
    const selectableHit = hits.find((hit) => (
      hit.object.isMesh &&
      hit.object.userData.pickable !== false &&
      hit.object.userData.assetRoot
    ));

    return selectableHit?.object.userData.assetRoot ?? null;
  }

  function pickAsset(event, asset = getAssetAtEvent(event)) {
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

    const hitAsset = asset;
    selectAsset(hitAsset);
  }

  function getGroundPoint(clientX, clientY) {
    const canvasPoint = getCanvasPoint(clientX, clientY);
    const { rect } = canvasPoint;

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    pointer.set(canvasPoint.x, canvasPoint.y);
    raycaster.setFromCamera(pointer, camera);

    if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) {
      return null;
    }

    if (
      Math.abs(groundPoint.x) > gridHalfSize ||
      Math.abs(groundPoint.y) > gridHalfSize
    ) {
      return null;
    }

    return groundPoint.clone();
  }

  function updateGridCursor(event) {
    const point = getGroundPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const cursor = gridMaterial.uniforms.cursorPosition.value;

    if (cursor.distanceToSquared(point) < 0.0001) {
      return;
    }

    cursor.set(point.x, point.y);
    render();
  }

  function getViewportPivot(event) {
    const selectedCenter = getSelectedAssetCenter();

    if (selectedCenter) {
      return selectedCenter;
    }

    const groundPivot = getGroundPoint(event.clientX, event.clientY);

    if (groundPivot) {
      return groundPivot;
    }

    camera.getWorldDirection(forward);
    return camera.position.clone().addScaledVector(forward, 10);
  }

  function updateDragPreview(clientX, clientY) {
    dragPreview.style.left = `${clientX}px`;
    dragPreview.style.top = `${clientY}px`;
  }

  function setDragPreviewIcon(button) {
    const iconName = button.getAttribute("name");

    dragPreview.replaceChildren();

    if (iconName) {
      const icon = document.createElement("sl-icon");

      icon.name = iconName;
      dragPreview.append(icon);
      return;
    }

    dragPreview.innerHTML = button.innerHTML;
  }

  function beginAssetDrag(event) {
    if (isPlayModeActive()) {
      return;
    }

    const roadToolButton = event.target.closest('[data-system-tool="road"]');

    if (roadToolButton && event.button === 0) {
      event.preventDefault();
      setRoadDrawingMode(!roadDrawingMode);
      return;
    }

    const button = event.target.closest("[data-asset]");

    if (!button || event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragState = {
      type: button.dataset.asset,
      pointerId: event.pointerId,
      source: button
    };

    try {
      button.setPointerCapture(event.pointerId);
    } catch {
    }

    setDragPreviewIcon(button);
    dragPreview.classList.add("is-visible");
    updateDragPreview(event.clientX, event.clientY);
  }

  function moveAssetDrag(event) {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    updateDragPreview(event.clientX, event.clientY);
  }

  function endAssetDrag(event) {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const point = getGroundPoint(event.clientX, event.clientY);

    try {
      if (dragState.source.hasPointerCapture(dragState.pointerId)) {
        dragState.source.releasePointerCapture(dragState.pointerId);
      }
    } catch {
    }

    if (point) {
      placeAsset(dragState.type, point);
    }

    dragPreview.classList.remove("is-visible");
    dragPreview.replaceChildren();
    dragState = null;
  }

  function focusSelectedAsset() {
    if (!selectedAsset) {
      return false;
    }

    const box = new THREE.Box3().setFromObject(selectedAsset);

    if (box.isEmpty()) {
      return false;
    }

    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.75);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const framingFov = Math.min(verticalFov, horizontalFov);
    const distance = Math.max(radius / Math.sin(framingFov / 2), 3) * 1.35;

    camera.getWorldDirection(forward);

    if (forward.lengthSq() === 0) {
      forward.set(0, 0, -1);
    }

    camera.position.copy(center).addScaledVector(forward.normalize(), -distance);
    camera.lookAt(center);
    cameraControls.syncRotationFromCamera();
    render();
    return true;
  }

  function getSelectedAssetCenter() {
    if (!selectedAsset) {
      return null;
    }

    const box = new THREE.Box3().setFromObject(selectedAsset);

    if (box.isEmpty()) {
      return null;
    }

    return box.getCenter(new THREE.Vector3());
  }

  function getCanvasAspect() {
    const rect = renderer.domElement.getBoundingClientRect();

    return Math.max(1, rect.width) / Math.max(1, rect.height);
  }

  function getPlayRenderBounds() {
    if (!playViewportFrame) {
      return null;
    }

    const canvasRect = renderer.domElement.getBoundingClientRect();
    const frameRect = playViewportFrame.getBoundingClientRect();
    const left = THREE.MathUtils.clamp(frameRect.left - canvasRect.left, 0, canvasRect.width);
    const top = THREE.MathUtils.clamp(frameRect.top - canvasRect.top, 0, canvasRect.height);
    const right = THREE.MathUtils.clamp(frameRect.right - canvasRect.left, 0, canvasRect.width);
    const bottom = THREE.MathUtils.clamp(frameRect.bottom - canvasRect.top, 0, canvasRect.height);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);

    return {
      left: Math.round(left),
      bottom: Math.round(canvasRect.height - bottom),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function syncCameraProjection() {
    const nextAspect = getActiveCameraAspect();
    const nextFov = cameraSettings.fov;

    if (
      Math.abs(camera.aspect - nextAspect) < 0.0001 &&
      Math.abs(camera.fov - nextFov) < 0.0001
    ) {
      return false;
    }

    camera.fov = cameraSettings.fov;
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
    return true;
  }

  function renderSceneToActiveViewport() {
    const canvasWidth = renderer.domElement.clientWidth;
    const canvasHeight = renderer.domElement.clientHeight;

    renderer.setViewport(0, 0, canvasWidth, canvasHeight);
    renderer.setScissorTest(false);

    if (!isPlayModeActive()) {
      renderer.render(scene, camera);
      return;
    }

    const bounds = getPlayRenderBounds();

    if (!bounds) {
      renderer.render(scene, camera);
      return;
    }

    renderer.clear(true, true, true);
    renderer.setViewport(bounds.left, bounds.bottom, bounds.width, bounds.height);
    renderer.setScissor(bounds.left, bounds.bottom, bounds.width, bounds.height);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, canvasWidth, canvasHeight);
  }

  function render() {
    renderer.setRenderTarget(null);
    syncCameraProjection();
    syncSceneLights();
    renderSceneToActiveViewport();
    selectionOutline.render(selectedAsset, selectionOutlineVisible);
    renderCapturedCameraPreviews();
  }

  function getViewportBounds() {
    const leftPanel = document.querySelector("#left-ui-panel");
    const rightPanel = document.querySelector("#right-ui-panel");
    const left = leftPanel?.getBoundingClientRect().right ?? 0;
    const right = rightPanel?.getBoundingClientRect().left ?? window.innerWidth;

    return {
      left,
      top: 0,
      width: Math.max(1, right - left),
      height: Math.max(1, window.innerHeight)
    };
  }

  function resize() {
    const viewport = getViewportBounds();

    renderer.setSize(viewport.width, viewport.height);
    syncCameraProjection();
    renderer.domElement.style.left = `${viewport.left}px`;
    renderer.domElement.style.top = `${viewport.top}px`;
    selectionOutline.resize(viewport.width, viewport.height);
    resizeCapturedCameraPreviews();
    render();
  }

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

  function pressKey(event) {
    if (playMode.handleKeyDown(event)) {
      return;
    }

    const code = event.code.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && code === "keyz" && !isTransformDragging) {
      event.preventDefault();
      undoLastAction();
      return;
    }

    if (
      (code === "delete" || code === "backspace") &&
      selectedAsset &&
      !cameraControls.isRightButtonDown() &&
      !isTransformDragging &&
      !cameraControls.isDragging()
    ) {
      event.preventDefault();
      deleteSelectedAsset();
      return;
    }

    if (!cameraControls.isRightButtonDown() && selectedAsset) {
      if (code === "keyq") {
        event.preventDefault();
        transformGizmoVisible = !transformGizmoVisible;
        updateSelectionFeedback();
        render();
        return;
      }

      if (code === "keyg") {
        event.preventDefault();
        selectionOutlineVisible = !selectionOutlineVisible;
        updateSelectionFeedback();
        render();
        return;
      }

      if (TRANSFORM_MODE_KEYS[code]) {
        event.preventDefault();
        setTransformMode(TRANSFORM_MODE_KEYS[code]);
        return;
      }

      if (code === "keyf" && focusSelectedAsset()) {
        event.preventDefault();
        return;
      }

      if (code === "escape") {
        event.preventDefault();
        selectAsset(null);
        return;
      }
    }

    if (!cameraControls.isRightButtonDown()) {
      return;
    }

    event.preventDefault();
    cameraControls.pressKey(code);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", pressKey);
  window.addEventListener("keyup", (event) => {
    if (playMode.handleKeyUp(event)) {
      return;
    }

    cameraControls.releaseKey(event);
  });
  window.addEventListener("blur", () => {
    playMode.clearInput();
    cameraControls.clearState();
  });
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  assetToolbar.addEventListener("pointerdown", beginAssetDrag);
  window.addEventListener("pointermove", (event) => {
    if (playMode.handlePointerMove(event)) {
      return;
    }

    moveAssetDrag(event);
  });
  window.addEventListener("pointerup", endAssetDrag);
  window.addEventListener("pointerup", endRoadDrawing);
  window.addEventListener("pointercancel", endAssetDrag);
  window.addEventListener("pointercancel", endRoadDrawing);
  transformToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transform-mode]");

    if (button) {
      setTransformMode(button.dataset.transformMode);
    }
  });
  fovRange?.addEventListener("input", () => {
    setCameraFov(fovRange.value);
  });
  aspectPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.aspectPreset;
      const parsedPreset = parseAspectPreset(preset);

      if (!parsedPreset) {
        return;
      }

      setRuntimeAspect(parsedPreset.width, parsedPreset.height, preset);
    });
  });
  cameraSpeedInput?.addEventListener("input", () => {
    setCameraMoveSpeed(cameraSpeedInput.value);
  });
  cameraSpeedInput?.addEventListener("change", () => {
    setCameraMoveSpeed(cameraSpeedInput.value);
  });
  rightPanelToggleButton?.addEventListener("click", () => {
    setRightPanelCollapsed(!rightPanelCollapsed);
  });
  runButton?.addEventListener("click", togglePlayMode);
  renderer.domElement.addEventListener("pointerdown", prepareTransformDuplicate, true);
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (isPlayModeActive()) {
      playMode.handlePointerDown(event);
      return;
    }

    if (beginRoadDrawing(event)) {
      return;
    }

    cameraControls.handlePointerDown(event);
  });
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

    if (continueRoadDrawing(event)) {
      return;
    }

    cameraControls.handlePointerMove(event);
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    endRoadDrawing();

    if (!isPlayModeActive()) {
      cameraControls.handlePointerUp(event);
    }
  });
  renderer.domElement.addEventListener("pointercancel", (event) => {
    endRoadDrawing();

    if (!isPlayModeActive()) {
      cameraControls.handlePointerUp(event);
    }
  });
  renderer.domElement.addEventListener("wheel", (event) => {
    if (isPlayModeActive()) {
      event.preventDefault();
      return;
    }

    cameraControls.zoomView(event);
  }, { passive: false });
  refreshCameraSettingsUi();
  renderer.setAnimationLoop(tick);
  cameraControls.syncRotationFromCamera();
  render();
}
