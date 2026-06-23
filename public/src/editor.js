import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createAsset, getAssetGridOffset } from "./assets.js";
import { createCameraController } from "./camera-controls.js";
import { createPlayModeController } from "./play-mode.js";
import { createSelectionOutline } from "./selection-outline.js";
import { createUnrealRockSyncController } from "./ue-rock-sync.js";

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
const unrealCentimetersPerSceneUnit = 100;
const rightPanelMinWidth = 52;
const rightPanelDefaultWidth = 280;
const rightPanelColumnWidth = 228;
const rightPanelMaxColumns = 4;

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
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.left = `${initialViewport.left}px`;
  renderer.domElement.style.top = `${initialViewport.top}px`;
  renderer.domElement.tabIndex = 0;
  document.body.appendChild(renderer.domElement);

  const selectionOutline = createSelectionOutline(renderer, camera);

  const environmentSettings = {
    color: new THREE.Color(0x8a9bb0),
    intensity: 0.9
  };

  const ambientLight = new THREE.HemisphereLight(
    environmentSettings.color.getHex(),
    environmentSettings.color.getHex(),
    environmentSettings.intensity
  );
  scene.add(ambientLight);

  function applyEnvironmentColor() {
    // Sky color stays neutral so the lit (top) side is not tinted.
    // Ground color carries the environment color -> lands on the dark side.
    ambientLight.color.setRGB(1, 1, 1);
    ambientLight.groundColor.copy(environmentSettings.color);
    ambientLight.intensity = environmentSettings.intensity;
  }

  function setEnvironmentColor(hex) {
    environmentSettings.color.set(hex);
    applyEnvironmentColor();
  }

  function setEnvironmentIntensity(value) {
    const intensity = clampNumber(Number(value) || 0, 0, 2);
    environmentSettings.intensity = intensity;
    applyEnvironmentColor();
    return intensity;
  }

  applyEnvironmentColor();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(8, 14, 10);
  directionalLight.castShadow = true;
  // 4096 map over a tighter ±60 frustum keeps texels small (~0.029 world units),
  // which is what stops the shadow edges from shimmering as the camera moves.
  directionalLight.shadow.mapSize.set(4096, 4096);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 400;
  directionalLight.shadow.camera.left = -60;
  directionalLight.shadow.camera.right = 60;
  directionalLight.shadow.camera.top = 60;
  directionalLight.shadow.camera.bottom = -60;
  directionalLight.shadow.bias = -0.00015;
  directionalLight.shadow.normalBias = 0.03;
  directionalLight.shadow.radius = 0;
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  const gridSize = 500;
  const gridSnapSize = 1;
  const gridOriginLineWidth = 0.04;
  const gridOriginLineElevation = 0.004;
  const scaleSnapSize = 1;
  let activeGridHalfSize = gridSize / 2;
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
      opacity: 0.4,
      transparent: true
    })
  );

  shadowReceiver.name = "ground-shadow-receiver";
  shadowReceiver.position.z = -0.01;
  shadowReceiver.receiveShadow = true;
  shadowReceiver.userData.pickable = false;
  scene.add(shadowReceiver);

  // Opaque depth-writing floor so objects sinking below z=0 get occluded
  // ("buried" look). White to match the background; visually invisible but it
  // fills the depth buffer, unlike the transparent shadow/grid materials.
  const groundOccluder = new THREE.Mesh(
    new THREE.PlaneGeometry(gridSize, gridSize, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  groundOccluder.name = "ground-occluder";
  groundOccluder.position.z = -0.012;
  groundOccluder.renderOrder = -1;
  groundOccluder.userData.pickable = false;
  scene.add(groundOccluder);

  const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
  const grid = new THREE.Mesh(gridGeometry, gridMaterial);
  scene.add(grid);

  const gridOriginMaterial = new THREE.MeshBasicMaterial({
    color: 0x5f6872,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    depthTest: true
  });
  const gridOriginXLine = new THREE.Mesh(
    new THREE.PlaneGeometry(gridSize, gridOriginLineWidth),
    gridOriginMaterial
  );
  const gridOriginYLine = new THREE.Mesh(
    new THREE.PlaneGeometry(gridOriginLineWidth, gridSize),
    gridOriginMaterial
  );
  gridOriginXLine.name = "grid-origin-x-line";
  gridOriginYLine.name = "grid-origin-y-line";
  gridOriginXLine.position.z = gridOriginLineElevation;
  gridOriginYLine.position.z = gridOriginLineElevation;
  gridOriginXLine.renderOrder = 1;
  gridOriginYLine.renderOrder = 1;
  gridOriginXLine.userData.pickable = false;
  gridOriginYLine.userData.pickable = false;
  scene.add(gridOriginXLine, gridOriginYLine);

  const assetToolbar = document.querySelector("#asset-toolbar");
  const transformToolbar = document.querySelector("#transform-toolbar");
  const transformButtons = Array.from(document.querySelectorAll("[data-transform-mode]"));
  const runButton = document.querySelector('[data-system-tool="run"]');
  const roadButton = document.querySelector('[data-system-tool="road"]');
  const rightPanel = document.querySelector("#right-ui-panel");
  const rightPanelResizeHandle = document.querySelector("#right-panel-resize-handle");
  const leftPanelTabs = Array.from(document.querySelectorAll("[data-left-panel-tab]"));
  const leftPanelPanels = Array.from(document.querySelectorAll("[data-left-panel-panel]"));
  const modelTransformEmpty = document.querySelector("#model-transform-empty");
  const modelTransformDetails = document.querySelector("#model-transform-details");
  const modelTransformName = document.querySelector("#model-transform-name");
  const modelTransformType = document.querySelector("#model-transform-type");
  const modelLocationX = document.querySelector("#model-location-x");
  const modelLocationY = document.querySelector("#model-location-y");
  const modelLocationZ = document.querySelector("#model-location-z");
  const modelRotationX = document.querySelector("#model-rotation-x");
  const modelRotationY = document.querySelector("#model-rotation-y");
  const modelRotationZ = document.querySelector("#model-rotation-z");
  const modelScaleX = document.querySelector("#model-scale-x");
  const modelScaleY = document.querySelector("#model-scale-y");
  const modelScaleZ = document.querySelector("#model-scale-z");
  const sceneOutlinerEmpty = document.querySelector("#scene-outliner-empty");
  const sceneOutlinerList = document.querySelector("#scene-outliner-list");
  const ueRockSyncButton = document.querySelector("#ue-rock-sync-button");
  const ueRockSyncStatus = document.querySelector("#ue-rock-sync-status");
  const ueRockSyncCount = document.querySelector("#ue-rock-sync-count");
  const ueSemanticModeButton = document.querySelector("#ue-semantic-mode-button");
  const localSetupCheckButton = document.querySelector("#local-setup-check-button");
  const localSetupCheckStatus = document.querySelector("#local-setup-check-status");
  const localSetupCheckResults = document.querySelector("#local-setup-check-results");
  const ueProjectPathInput = document.querySelector("#ue-project-path-input");
  const deployUeExportToolsButton = document.querySelector("#deploy-ue-export-tools-button");
  const ueExportDeployStatus = document.querySelector("#ue-export-deploy-status");
  const ueExportDeployResults = document.querySelector("#ue-export-deploy-results");
  const playViewportFrame = document.querySelector("#play-viewport-frame");
  const fovRange = document.querySelector("#camera-fov-range");
  const fovValue = document.querySelector("#camera-fov-value");
  const runtimeAspectValue = document.querySelector("#runtime-aspect-value");
  const cameraSpeedInput = document.querySelector("#camera-speed-input");
  const aspectPresetButtons = Array.from(document.querySelectorAll("[data-aspect-preset]"));
  const envColorInput = document.querySelector("#env-color-input");
  const envIntensityRange = document.querySelector("#env-intensity-range");
  const envIntensityValue = document.querySelector("#env-intensity-value");
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
  let copiedAsset = null;
  let duplicateOnTransformDrag = false;
  let duplicatedTransformAsset = null;
  let isTransformDragging = false;
  let transformStart = null;
  let lastFrameTime = 0;
  let activeTransformMode = "translate";
  let transformGizmoVisible = true;
  let selectionOutlineVisible = true;
  let rightPanelWidth = rightPanel?.getBoundingClientRect().width ?? rightPanelDefaultWidth;
  let rightPanelResizeState = null;
  let rightPanelResizeFrame = 0;
  let sceneOutlinerDirty = true;
  let roadDrawingMode = false;
  let roadDrawing = false;
  let roadDrawingTiles = [];
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
      ? duplicatedTransformAsset || duplicateAssetForTransform(selectedAsset)
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

  function formatUnrealCentimeters(value) {
    const centimeters = value * unrealCentimetersPerSceneUnit;
    const rounded = Math.abs(centimeters) < 0.005
      ? 0
      : Math.round(centimeters * 100) / 100;
    const formatted = Number.isInteger(rounded)
      ? `${rounded}`
      : `${rounded}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

    return `${formatted} cm`;
  }

  function formatModelDegrees(value) {
    const degrees = THREE.MathUtils.radToDeg(value);
    const rounded = Math.abs(degrees) < 0.005
      ? 0
      : Math.round(degrees * 100) / 100;
    const formatted = Number.isInteger(rounded)
      ? `${rounded}`
      : `${rounded}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

    return `${formatted} deg`;
  }

  function formatModelScale(value) {
    const rounded = Math.abs(value) < 0.0005
      ? 0
      : Math.round(value * 1000) / 1000;

    return Number.isInteger(rounded)
      ? `${rounded}`
      : `${rounded}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function updateModelTransformPanel() {
    if (
      !modelTransformEmpty ||
      !modelTransformDetails ||
      !modelTransformName ||
      !modelTransformType ||
      !modelLocationX ||
      !modelLocationY ||
      !modelLocationZ ||
      !modelRotationX ||
      !modelRotationY ||
      !modelRotationZ ||
      !modelScaleX ||
      !modelScaleY ||
      !modelScaleZ
    ) {
      return;
    }

    const hasSelection = Boolean(selectedAsset);

    modelTransformEmpty.hidden = hasSelection;
    modelTransformDetails.hidden = !hasSelection;

    if (!selectedAsset) {
      return;
    }

    modelTransformName.textContent = selectedAsset.name || "Selected model";
    modelTransformType.textContent = `${selectedAsset.userData.assetType || "model"} · Unreal Units (cm)`;
    modelLocationX.textContent = formatUnrealCentimeters(selectedAsset.position.x);
    modelLocationY.textContent = formatUnrealCentimeters(selectedAsset.position.y);
    modelLocationZ.textContent = formatUnrealCentimeters(selectedAsset.position.z);
    modelRotationX.textContent = formatModelDegrees(selectedAsset.rotation.x);
    modelRotationY.textContent = formatModelDegrees(selectedAsset.rotation.y);
    modelRotationZ.textContent = formatModelDegrees(selectedAsset.rotation.z);
    modelScaleX.textContent = formatModelScale(selectedAsset.scale.x);
    modelScaleY.textContent = formatModelScale(selectedAsset.scale.y);
    modelScaleZ.textContent = formatModelScale(selectedAsset.scale.z);
  }

  function setLeftPanelTab(tabName) {
    if (!tabName) {
      return;
    }

    leftPanelTabs.forEach((tab) => {
      const active = tab.dataset.leftPanelTab === tabName;

      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", `${active}`);
    });

    leftPanelPanels.forEach((panel) => {
      panel.hidden = panel.dataset.leftPanelPanel !== tabName;
    });
  }

  function sceneOutlinerTypeLabel(type) {
    const labels = {
      "sun-light": "Light",
      "ue-scene-actor": "UE Actor",
      "ue-rock": "UE Rock",
      camera: "Camera",
      character: "Character",
      cube: "Cube",
      road: "Road",
      sphere: "Sphere"
    };

    return labels[type] || "Object";
  }

  function makeSceneOutlinerItem(object, type, fallbackName) {
    return {
      id: object.uuid,
      name: object.name || fallbackName,
      object,
      type,
      typeLabel: sceneOutlinerTypeLabel(type)
    };
  }

  function getSceneOutlinerItems() {
    const assetItems = placedAssets.map((asset) => makeSceneOutlinerItem(
      asset,
      asset.userData.assetType || "object",
      asset.name || "Asset"
    ));
    const roadItems = Array.from(roadTiles.values()).map((mesh, index) => makeSceneOutlinerItem(
      mesh,
      "road",
      `Road ${index + 1}`
    ));
    const ueRockItems = ueRockSync.group.children.map((object, index) => makeSceneOutlinerItem(
      object,
      object.userData.assetType || "ue-scene-actor",
      object.userData.label || object.name || `UE Actor ${index + 1}`
    ));
    const cameraItems = capturedCameraPreviews.map((preview, index) => makeSceneOutlinerItem(
      preview.camera,
      "camera",
      preview.camera.name || `Camera ${index + 1}`
    ));

    return [...assetItems, ...ueRockItems, ...roadItems, ...cameraItems];
  }

  function renderSceneOutliner() {
    if (!sceneOutlinerEmpty || !sceneOutlinerList) {
      sceneOutlinerDirty = false;
      return;
    }

    const items = getSceneOutlinerItems();

    sceneOutlinerEmpty.hidden = items.length > 0;
    sceneOutlinerList.hidden = items.length === 0;
    sceneOutlinerList.replaceChildren(
      ...items.map((item) => {
        const button = document.createElement("button");
        const name = document.createElement("span");
        const type = document.createElement("span");

        button.type = "button";
        button.className = "scene-outliner-item";
        button.dataset.sceneOutlinerItemId = item.id;
        button.classList.toggle("is-selected", item.object === selectedAsset);
        name.className = "scene-outliner-name";
        name.textContent = item.name;
        type.className = "scene-outliner-type";
        type.textContent = item.typeLabel;
        button.append(name, type);
        return button;
      })
    );
    sceneOutlinerDirty = false;
  }

  function markSceneOutlinerDirty() {
    sceneOutlinerDirty = true;
  }

  function flushSceneOutliner() {
    if (!sceneOutlinerDirty) {
      return;
    }

    renderSceneOutliner();
  }

  function selectSceneOutlinerItem(itemId) {
    const item = getSceneOutlinerItems().find((candidate) => candidate.id === itemId);

    if (!item) {
      return false;
    }

    selectAsset(item.object);
    return true;
  }

  function getSelectableSceneObjects() {
    return [...placedAssets, ...ueRockSync.group.children];
  }

  function updateUnrealRockSyncStatus(status) {
    if (ueRockSyncStatus) {
      ueRockSyncStatus.textContent = status.message;
    }

    if (ueRockSyncCount) {
      ueRockSyncCount.textContent = `${status.count ?? 0}`;
    }

    if (ueRockSyncButton) {
      ueRockSyncButton.disabled = status.state === "syncing";
    }
  }

  function setImportedSceneDisplayMode(mode) {
    ueRockSync.setDisplayMode(mode);

    if (ueSemanticModeButton) {
      const semanticMode = ueRockSync.getDisplayMode() === "semanticColor";

      ueSemanticModeButton.classList.toggle("is-active", semanticMode);
      ueSemanticModeButton.textContent = semanticMode ? "Gray Mode" : "ID Color Mode";
    }

    render();
  }

  function setLocalSetupCheckBusy(busy) {
    if (localSetupCheckButton) {
      localSetupCheckButton.disabled = busy;
      localSetupCheckButton.textContent = busy ? "Checking..." : "Check Local Setup";
    }
  }

  function setUeExportDeployBusy(busy) {
    if (deployUeExportToolsButton) {
      deployUeExportToolsButton.disabled = busy;
      deployUeExportToolsButton.textContent = busy ? "Deploying..." : "Deploy UE Export Tools";
    }
  }

  function createLocalSetupCheckItem(check) {
    const status = ["ok", "warning", "error"].includes(check.status) ? check.status : "warning";
    const item = document.createElement("div");
    const label = document.createElement("span");
    const message = document.createElement("span");

    item.className = `local-setup-check-item is-${status}`;
    label.className = "local-setup-check-label";
    message.className = "local-setup-check-message";
    label.textContent = check.label;
    message.textContent = check.message;
    item.append(label, message);

    if (check.details) {
      const details = document.createElement("span");

      details.className = "local-setup-check-detail";
      details.textContent = check.details;
      item.append(details);
    }

    if (check.command) {
      const command = document.createElement("span");

      command.className = "local-setup-check-command";
      command.textContent = check.command;
      item.append(command);
    }

    return item;
  }

  function renderLocalSetupChecks(payload) {
    if (localSetupCheckStatus) {
      localSetupCheckStatus.textContent = payload.summary || "Local setup checked";
    }

    if (!localSetupCheckResults) {
      return;
    }

    const checks = Array.isArray(payload.checks) ? payload.checks : [];

    localSetupCheckResults.hidden = checks.length === 0;
    localSetupCheckResults.replaceChildren(...checks.map(createLocalSetupCheckItem));
  }

  function renderLocalSetupCheckFailure(error) {
    if (localSetupCheckStatus) {
      localSetupCheckStatus.textContent = `Local setup check failed: ${error.message || error}`;
    }
  }

  function renderUeExportDeployResult(payload) {
    if (ueExportDeployStatus) {
      ueExportDeployStatus.textContent = payload.summary || "UE export tools deployment finished";
    }

    if (!ueExportDeployResults) {
      return;
    }

    const checks = Array.isArray(payload.checks) ? payload.checks : [];

    ueExportDeployResults.hidden = checks.length === 0;
    ueExportDeployResults.replaceChildren(...checks.map(createLocalSetupCheckItem));
  }

  function renderUeExportDeployFailure(error) {
    if (ueExportDeployStatus) {
      ueExportDeployStatus.textContent = `UE export tools deployment failed: ${error.message || error}`;
    }
  }

  async function runLocalSetupCheck() {
    setLocalSetupCheckBusy(true);

    try {
      const response = await fetch("/api/environment-check", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      renderLocalSetupChecks(await response.json());
    } catch (error) {
      renderLocalSetupCheckFailure(error);
    } finally {
      setLocalSetupCheckBusy(false);
    }
  }

  async function deployUeExportTools() {
    setUeExportDeployBusy(true);

    try {
      const response = await fetch("/api/deploy-ue-export-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uprojectPath: ueProjectPathInput?.value || ""
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      renderUeExportDeployResult(await response.json());
    } catch (error) {
      renderUeExportDeployFailure(error);
    } finally {
      setUeExportDeployBusy(false);
    }
  }

  function adaptImportedSceneToManifest(manifest) {
    const nextGridSize = Number(manifest?.gridSizeMeters);

    if (!Number.isFinite(nextGridSize) || nextGridSize <= gridSize) {
      return;
    }

    const gridScale = nextGridSize / gridSize;

    activeGridHalfSize = nextGridSize / 2;
    grid.scale.set(gridScale, gridScale, 1);
    shadowReceiver.scale.set(gridScale, gridScale, 1);
    gridOriginXLine.scale.set(gridScale, 1, 1);
    gridOriginYLine.scale.set(1, gridScale, 1);
    gridMaterial.uniforms.fadeDistance.value = nextGridSize / 2;
    camera.far = Math.max(camera.far, nextGridSize * 2);
    camera.updateProjectionMatrix();
  }

  const ueRockSync = createUnrealRockSyncController({
    THREE,
    scene,
    loader: new GLTFLoader(),
    simplifyModifier: null,
    mergeVertices: null,
    reductionRatio: 0,
    manifestUrl: "/ue-sync/scene.manifest.json",
    fallbackManifestUrl: "/ue-sync/rocks.instances.json",
    semanticRulesUrl: "/ue-sync/semantic.rules.json",
    onStatusChange: updateUnrealRockSyncStatus,
    onSynced: (manifest) => {
      adaptImportedSceneToManifest(manifest);

      if (
        (selectedAsset?.userData.assetType === "ue-rock" || selectedAsset?.userData.assetType === "ue-scene-actor") &&
        !selectedAsset.parent
      ) {
        selectAsset(null);
      }

      markSceneOutlinerDirty();
    },
    render
  });

  function getRightPanelMaxWidth() {
    const leftPanel = document.querySelector("#left-ui-panel");
    const leftPanelWidth = leftPanel?.getBoundingClientRect().width ?? 0;

    return Math.min(
      rightPanelMinWidth + rightPanelColumnWidth * rightPanelMaxColumns,
      Math.max(rightPanelMinWidth, window.innerWidth - leftPanelWidth + rightPanelMinWidth)
    );
  }

  function getRightPanelWidthSteps() {
    const maxWidth = getRightPanelMaxWidth();
    const steps = [rightPanelMinWidth];

    for (let columnCount = 1; columnCount <= rightPanelMaxColumns; columnCount += 1) {
      const step = rightPanelMinWidth + rightPanelColumnWidth * columnCount;

      if (step <= maxWidth + 0.5) {
        steps.push(step);
      }
    }

    return steps;
  }

  function snapRightPanelWidth(value) {
    const steps = getRightPanelWidthSteps();
    const target = clampNumber(Number(value), steps[0], steps.at(-1));

    return steps.reduce((closest, step) => (
      Math.abs(step - target) < Math.abs(closest - target) ? step : closest
    ), steps[0]);
  }

  function getRightPanelStepIndex() {
    const steps = getRightPanelWidthSteps();
    const currentWidth = snapRightPanelWidth(rightPanelWidth);

    return Math.max(0, steps.indexOf(currentWidth));
  }

  function setRightPanelStep(index) {
    const steps = getRightPanelWidthSteps();
    const nextIndex = Math.round(clampNumber(index, 0, steps.length - 1));

    setRightPanelWidth(steps[nextIndex]);
  }

  function requestEditorResize() {
    if (rightPanelResizeFrame) {
      return;
    }

    rightPanelResizeFrame = requestAnimationFrame(() => {
      rightPanelResizeFrame = 0;
      resize();
    });
  }

  function setRightPanelWidth(value, { scheduleResize = true } = {}) {
    const maxWidth = getRightPanelMaxWidth();
    const nextWidth = snapRightPanelWidth(value);

    rightPanelWidth = nextWidth;
    document.documentElement.style.setProperty("--right-panel-width", `${nextWidth}px`);
    document.body.classList.toggle("is-right-panel-minimized", nextWidth <= rightPanelMinWidth + 8);

    if (rightPanelResizeHandle) {
      rightPanelResizeHandle.setAttribute("aria-valuemax", `${Math.round(maxWidth)}`);
      rightPanelResizeHandle.setAttribute("aria-valuenow", `${nextWidth}`);
    }

    if (scheduleResize) {
      requestEditorResize();
    }
  }

  function beginRightPanelResize(event) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    rightPanelResizeState = {
      pointerId: event.pointerId
    };
    document.body.classList.add("is-resizing-right-panel");

    try {
      rightPanelResizeHandle.setPointerCapture(event.pointerId);
    } catch {
    }
  }

  function updateRightPanelResize(event) {
    if (!rightPanelResizeState || event.pointerId !== rightPanelResizeState.pointerId) {
      return;
    }

    event.preventDefault();
    setRightPanelWidth(window.innerWidth - event.clientX);
  }

  function endRightPanelResize(event) {
    if (!rightPanelResizeState || event.pointerId !== rightPanelResizeState.pointerId) {
      return;
    }

    try {
      if (rightPanelResizeHandle.hasPointerCapture(event.pointerId)) {
        rightPanelResizeHandle.releasePointerCapture(event.pointerId);
      }
    } catch {
    }

    rightPanelResizeState = null;
    document.body.classList.remove("is-resizing-right-panel");
  }

  function handleRightPanelResizeKey(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setRightPanelStep(getRightPanelStepIndex() + 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setRightPanelStep(getRightPanelStepIndex() - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setRightPanelStep(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setRightPanelStep(getRightPanelWidthSteps().length - 1);
    }
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
      return null;
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
    markSceneOutlinerDirty();
    render();
    return { key, mesh: roadTile };
  }

  function recordRoadTile(point) {
    const paintedTile = paintRoadAtPoint(point);

    if (paintedTile) {
      roadDrawingTiles.push(paintedTile);
    }

    return paintedTile;
  }

  function setRoadDrawingMode(active) {
    roadDrawingMode = Boolean(active);
    roadButton?.classList.toggle("is-active", roadDrawingMode);
    roadDrawing = false;
    roadDrawingTiles = [];
  }

  function cancelRoadDrawingMode() {
    if (roadDrawingMode) {
      setRoadDrawingMode(false);
    }
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
    roadDrawingTiles = [];
    recordRoadTile(point);
    return true;
  }

  function continueRoadDrawing(event) {
    if (!roadDrawing) {
      return false;
    }

    const point = getGroundPoint(event.clientX, event.clientY);

    event.preventDefault();

    if (point) {
      recordRoadTile(point);
    }

    return true;
  }

  function endRoadDrawing() {
    if (!roadDrawing) {
      return;
    }

    roadDrawing = false;

    if (roadDrawingTiles.length > 0) {
      pushUndo({ type: "road-draw", tiles: [...roadDrawingTiles] });
    }

    roadDrawingTiles = [];
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

      if (child.userData.outline) {
        child.castShadow = false;
        child.receiveShadow = false;
        return;
      }

      child.castShadow = true;
      child.receiveShadow = false;
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
    capturedCamera.name = `Camera ${capturedCameraPreviews.length + 1}`;
    capturedCamera.userData.assetType = "camera";
    capturedCamera.userData.pickable = false;

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
    markSceneOutlinerDirty();
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
    markSceneOutlinerDirty();
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

  function isImportedEditableAsset(asset) {
    return String(asset?.userData?.assetType || "").startsWith("ue-");
  }

  function duplicateAssetForTransform(sourceAsset) {
    if (isImportedEditableAsset(sourceAsset)) {
      return duplicateImportedAsset(sourceAsset);
    }

    const type = sourceAsset.userData.assetType;
    const duplicate = markAsset(createAsset(type, { cubeSizeMeters, defaultAssetColor }), type);

    applyTransform(duplicate, captureTransform(sourceAsset));
    scene.add(duplicate);
    selectAsset(duplicate);
    return duplicate;
  }

  function markImportedDuplicateAsset(asset, sourceAsset) {
    const sourceId = sourceAsset.userData.assetId || sourceAsset.name || "ue-import";
    const id = `${sourceId}-copy-${nextAssetId}`;
    nextAssetId += 1;

    asset.name = id;
    asset.userData = {
      ...(sourceAsset.userData || {}),
      ...(asset.userData || {}),
      assetRoot: asset,
      assetId: id,
      label: `${sourceAsset.userData.label || sourceAsset.name || sourceId} Copy`
    };

    asset.traverse((child) => {
      child.userData = {
        ...(child.userData || {}),
        assetRoot: asset,
        assetId: id,
        assetType: sourceAsset.userData.assetType
      };

      if (child.isMesh) {
        child.userData.pickable = true;
      }
    });

    configureAssetShadows(asset);
    return asset;
  }

  function duplicateImportedAsset(sourceAsset) {
    const duplicate = markImportedDuplicateAsset(sourceAsset.clone(true), sourceAsset);

    applyTransform(duplicate, captureTransform(sourceAsset));
    ueRockSync.group.add(duplicate);
    markSceneOutlinerDirty();
    selectAsset(duplicate);
    return duplicate;
  }

  function duplicateSelectedAsset() {
    if (
      !selectedAsset ||
      isPlayModeActive() ||
      isTransformDragging ||
      cameraControls.isDragging() ||
      !getEditableAssetCollection(selectedAsset)
    ) {
      return false;
    }

    const duplicate = duplicateAssetForTransform(selectedAsset);
    duplicate.position.x += gridSnapSize;
    duplicate.position.y += gridSnapSize;
    duplicate.updateMatrixWorld(true);
    pushUndo({ type: "duplicate", asset: duplicate });
    markSceneOutlinerDirty();
    render();
    return true;
  }

  function copySelectedAsset() {
    if (!selectedAsset || !getEditableAssetCollection(selectedAsset)) {
      return false;
    }

    copiedAsset = selectedAsset;
    return true;
  }

  function pasteCopiedAsset() {
    if (
      !copiedAsset ||
      isPlayModeActive() ||
      isTransformDragging ||
      cameraControls.isDragging()
    ) {
      return false;
    }

    const duplicate = duplicateAssetForTransform(copiedAsset);
    duplicate.position.x += gridSnapSize;
    duplicate.position.y += gridSnapSize;
    duplicate.updateMatrixWorld(true);
    pushUndo({ type: "duplicate", asset: duplicate });
    markSceneOutlinerDirty();
    render();
    return true;
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

  function getEditableAssetCollection(asset) {
    if (!asset) {
      return null;
    }

    if (placedAssets.includes(asset)) {
      return placedAssets;
    }

    if (ueRockSync.group.children.includes(asset)) {
      return ueRockSync.group.children;
    }

    return null;
  }

  function getRestorableAssetCollection(asset) {
    return getEditableAssetCollection(asset)
      || (isImportedEditableAsset(asset) ? ueRockSync.group.children : placedAssets);
  }

  function getEditableAssetParent(asset) {
    const collection = getRestorableAssetCollection(asset);
    return collection === ueRockSync.group.children ? ueRockSync.group : scene;
  }

  function removeAsset(asset) {
    const collection = getEditableAssetCollection(asset);
    const index = collection ? collection.indexOf(asset) : -1;
    const parent = asset.parent;

    if (parent?.children === collection) {
      parent.remove(asset);
    } else if (index !== -1) {
      collection.splice(index, 1);
    }

    parent?.remove(asset);
    scene.remove(asset);
    markSceneOutlinerDirty();

    if (selectedAsset === asset) {
      selectAsset(null);
    }

    return index;
  }

  function restoreAsset(asset, index) {
    const collection = getRestorableAssetCollection(asset);
    const parent = getEditableAssetParent(asset);

    if (!collection.includes(asset)) {
      const safeIndex = THREE.MathUtils.clamp(index, 0, collection.length);

      if (parent.children === collection) {
        parent.add(asset);
        const appendedIndex = collection.indexOf(asset);

        if (appendedIndex !== -1) {
          collection.splice(appendedIndex, 1);
        }
      }

      collection.splice(safeIndex, 0, asset);
    }

    if (!asset.parent) {
      parent.add(asset);
    }

    markSceneOutlinerDirty();
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
    const collection = getEditableAssetCollection(asset);
    const index = collection ? collection.indexOf(asset) : -1;

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
      if (!getEditableAssetCollection(action.asset)) {
        return true;
      }

      applyTransform(action.asset, action.before);
      selectAsset(action.asset);
      render();
      return true;
    }

    if (action.type === "road-draw") {
      action.tiles.forEach((tile) => {
        scene.remove(tile.mesh);
        roadTiles.delete(tile.key);
      });
      markSceneOutlinerDirty();
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
    markSceneOutlinerDirty();

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
    duplicatedTransformAsset = null;

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

    if (transformControls.axis === null) {
      return;
    }

    duplicatedTransformAsset = duplicateAssetForTransform(selectedAsset);
    duplicateOnTransformDrag = true;
  }

  function getAssetAtEvent(event) {
    getPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(getSelectableSceneObjects(), true);
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
      Math.abs(groundPoint.x) > activeGridHalfSize ||
      Math.abs(groundPoint.y) > activeGridHalfSize
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
    cancelRoadDrawingMode();
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
    updateModelTransformPanel();
    flushSceneOutliner();
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
    setRightPanelWidth(rightPanelWidth, { scheduleResize: false });
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

    if ((event.ctrlKey || event.metaKey) && code === "keyd" && duplicateSelectedAsset()) {
      event.preventDefault();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && code === "keyc" && copySelectedAsset()) {
      event.preventDefault();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && code === "keyv" && pasteCopiedAsset()) {
      event.preventDefault();
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
      cancelRoadDrawingMode();
      setTransformMode(button.dataset.transformMode);
    }
  });
  fovRange?.addEventListener("input", () => {
    setCameraFov(fovRange.value);
  });
  if (envColorInput) {
    envColorInput.value = `#${environmentSettings.color.getHexString()}`;
    envColorInput.addEventListener("input", () => {
      setEnvironmentColor(envColorInput.value);
      render();
    });
  }
  if (envIntensityRange) {
    envIntensityRange.value = `${environmentSettings.intensity}`;
    envIntensityRange.addEventListener("input", () => {
      const intensity = setEnvironmentIntensity(envIntensityRange.value);
      if (envIntensityValue) {
        envIntensityValue.textContent = intensity.toFixed(2);
      }
      render();
    });
  }
  if (envIntensityValue) {
    envIntensityValue.textContent = environmentSettings.intensity.toFixed(2);
  }
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
  leftPanelTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setLeftPanelTab(tab.dataset.leftPanelTab);
    });
  });
  rightPanelResizeHandle?.addEventListener("pointerdown", beginRightPanelResize);
  rightPanelResizeHandle?.addEventListener("keydown", handleRightPanelResizeKey);
  rightPanelResizeHandle?.addEventListener("dblclick", () => {
    setRightPanelWidth(rightPanelDefaultWidth);
  });
  sceneOutlinerList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scene-outliner-item-id]");

    if (button) {
      selectSceneOutlinerItem(button.dataset.sceneOutlinerItemId);
    }
  });
  ueRockSyncButton?.addEventListener("click", () => {
    ueRockSync.sync().catch(() => {});
  });
  ueSemanticModeButton?.addEventListener("click", () => {
    setImportedSceneDisplayMode(ueRockSync.getDisplayMode() === "semanticColor" ? "gray" : "semanticColor");
  });
  localSetupCheckButton?.addEventListener("click", runLocalSetupCheck);
  deployUeExportToolsButton?.addEventListener("click", deployUeExportTools);
  window.addEventListener("pointermove", updateRightPanelResize);
  window.addEventListener("pointerup", endRightPanelResize);
  window.addEventListener("pointercancel", endRightPanelResize);
  runButton?.addEventListener("click", () => {
    cancelRoadDrawingMode();
    togglePlayMode();
  });
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
  setRightPanelWidth(rightPanelWidth, { scheduleResize: false });
  refreshCameraSettingsUi();
  renderer.setAnimationLoop(tick);
  cameraControls.syncRotationFromCamera();
  render();
}
