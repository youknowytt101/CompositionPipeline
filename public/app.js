import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.up.set(0, 0, 1);
camera.position.set(10, -16, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.tabIndex = 0;
document.body.appendChild(renderer.domElement);

const selectionOutlineTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false
  }
);
const selectionOutlineMaskScene = new THREE.Scene();
const selectionOutlineMaskMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide
});
const selectionOutlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const selectionOutlineTexelSize = new THREE.Vector2(
  1 / window.innerWidth,
  1 / window.innerHeight
);
const selectionOutlineCompositeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    maskTexture: { value: selectionOutlineTarget.texture },
    texelSize: { value: selectionOutlineTexelSize },
    outlineColor: { value: new THREE.Color(0xffc400) },
    outlineWidth: { value: 2.5 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D maskTexture;
    uniform vec2 texelSize;
    uniform vec3 outlineColor;
    uniform float outlineWidth;

    varying vec2 vUv;

    float maskSample(vec2 offset) {
      return texture2D(maskTexture, vUv + offset).r;
    }

    void main() {
      vec2 px = texelSize * outlineWidth;
      vec2 halfPx = texelSize * max(outlineWidth * 0.5, 1.0);
      float center = maskSample(vec2(0.0));
      float neighbor = 0.0;

      neighbor = max(neighbor, maskSample(vec2(px.x, 0.0)));
      neighbor = max(neighbor, maskSample(vec2(-px.x, 0.0)));
      neighbor = max(neighbor, maskSample(vec2(0.0, px.y)));
      neighbor = max(neighbor, maskSample(vec2(0.0, -px.y)));
      neighbor = max(neighbor, maskSample(vec2(px.x, px.y)));
      neighbor = max(neighbor, maskSample(vec2(-px.x, px.y)));
      neighbor = max(neighbor, maskSample(vec2(px.x, -px.y)));
      neighbor = max(neighbor, maskSample(vec2(-px.x, -px.y)));
      neighbor = max(neighbor, maskSample(vec2(halfPx.x, 0.0)));
      neighbor = max(neighbor, maskSample(vec2(-halfPx.x, 0.0)));
      neighbor = max(neighbor, maskSample(vec2(0.0, halfPx.y)));
      neighbor = max(neighbor, maskSample(vec2(0.0, -halfPx.y)));

      float outline = step(0.5, neighbor) * (1.0 - step(0.5, center));
      gl_FragColor = vec4(outlineColor, outline);
    }
  `,
  transparent: true,
  depthTest: false,
  depthWrite: false
});
const selectionOutlineCompositeScene = new THREE.Scene();
selectionOutlineCompositeScene.add(
  new THREE.Mesh(new THREE.PlaneGeometry(2, 2), selectionOutlineCompositeMaterial)
);
const selectionMaskMeshes = [];
const previousClearColor = new THREE.Color();

const ambientLight = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
directionalLight.position.set(8, 14, 10);
scene.add(directionalLight);

const gridSize = 200;
const gridHalfSize = gridSize / 2;
const gridMaterial = new THREE.ShaderMaterial({
  extensions: {
    derivatives: true
  },
  uniforms: {
    backgroundColor: { value: new THREE.Color(0xffffff) },
    lineColor: { value: new THREE.Color(0x666666) },
    minorGridSize: { value: 1 },
    gridFadeStart: { value: 35 },
    gridFadeEnd: { value: 85 }
  },
  vertexShader: `
    varying vec3 worldPosition;
    varying float viewDepth;

    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec4 view = modelViewMatrix * vec4(position, 1.0);

      worldPosition = world.xyz;
      viewDepth = -view.z;
      gl_Position = projectionMatrix * view;
    }
  `,
  fragmentShader: `
    uniform vec3 backgroundColor;
    uniform vec3 lineColor;
    uniform float minorGridSize;
    uniform float gridFadeStart;
    uniform float gridFadeEnd;

    varying vec3 worldPosition;
    varying float viewDepth;

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
      vec2 minorCoord = position / minorGridSize;

      float distanceFade = 1.0 - smoothstep(gridFadeStart, gridFadeEnd, viewDepth);
      float grid = gridLine(minorCoord) * screenDensityFade(minorCoord) * distanceFade * 0.32;
      grid = clamp(grid, 0.0, 1.0);

      gl_FragColor = vec4(mix(backgroundColor, lineColor, grid), 1.0);
    }
  `
});
const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
const grid = new THREE.Mesh(gridGeometry, gridMaterial);
scene.add(grid);

const assetToolbar = document.querySelector("#asset-toolbar");
const transformToolbar = document.querySelector("#transform-toolbar");
const transformButtons = Array.from(document.querySelectorAll("[data-transform-mode]"));
const dragPreview = document.querySelector("#drag-preview");
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const groundPoint = new THREE.Vector3();
const placedAssets = [];
const keys = new Set();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 0, 1);
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
const gridSnapSize = 1;
const cubeSizeMeters = 1;
const defaultAssetColor = 0x808080;
const rotationSnapAngle = THREE.MathUtils.degToRad(15);
const minCameraMoveSpeed = 1;
const maxCameraMoveSpeed = 80;

let dragState = null;
let nextAssetId = 1;
let selectedAsset = null;
let cameraDragState = null;
let pendingClick = null;
let duplicateOnTransformDrag = false;
let duplicatedTransformAsset = null;
let isTransformDragging = false;
let transformStart = null;
let lastFrameTime = 0;
let cameraMoveSpeed = 7;
let activeTransformMode = "translate";
let transformGizmoVisible = true;
let selectionOutlineVisible = true;
let yaw = 0;
let pitch = 0;
const undoStack = [];

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSpace("world");
transformControls.setSize(0.85);
transformControls.setTranslationSnap(null);
transformControls.setRotationSnap(rotationSnapAngle);
transformControls.setScaleSnap(gridSnapSize);
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

function createCube() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(cubeSizeMeters, cubeSizeMeters, cubeSizeMeters);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: defaultAssetColor, roughness: 0.58 })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0x1f1f1f, transparent: true, opacity: 0.38 })
  );

  mesh.position.z = cubeSizeMeters / 2;
  edges.position.copy(mesh.position);
  edges.userData.pickable = false;
  group.add(mesh, edges);
  return group;
}

function createSphere() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 18),
    new THREE.MeshStandardMaterial({ color: defaultAssetColor, roughness: 0.62 })
  );

  mesh.position.z = 0.55;
  return mesh;
}

function createCharacter() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: defaultAssetColor, roughness: 0.7 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: defaultAssetColor, roughness: 0.65 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.85, 6, 14), material);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), headMaterial);
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.12), material);
  const rightFoot = leftFoot.clone();

  body.rotation.x = Math.PI / 2;
  body.position.z = 0.82;
  head.position.z = 1.54;
  leftFoot.position.set(-0.16, 0.04, 0.06);
  rightFoot.position.set(0.16, 0.04, 0.06);
  group.add(body, head, leftFoot, rightFoot);
  return group;
}

function createAsset(type) {
  if (type === "cube") {
    return createCube();
  }

  if (type === "sphere") {
    return createSphere();
  }

  return createCharacter();
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
  const duplicate = markAsset(createAsset(type), type);

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

function getAssetGridOffset(assetOrType) {
  const type = typeof assetOrType === "string"
    ? assetOrType
    : assetOrType.userData.assetType;

  return type === "cube" ? cubeSizeMeters / 2 : 0;
}

function snapAssetPosition(asset) {
  const gridOffset = getAssetGridOffset(asset);

  asset.position.x = snapToGrid(asset.position.x, gridOffset);
  asset.position.y = snapToGrid(asset.position.y, gridOffset);
  asset.position.z = snapToGrid(asset.position.z);
}

function placeAsset(type, point) {
  const asset = markAsset(createAsset(type), type);
  asset.position.set(point.x, point.y, 0);
  snapAssetPosition(asset);
  scene.add(asset);
  selectAsset(asset);
  pushUndo({ type: "create", asset });
  render();
}

function deleteSelectedAsset() {
  if (!selectedAsset || isTransformDragging || cameraDragState) {
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
  selectionOutlineMaskScene.clear();
  selectionMaskMeshes.length = 0;

  if (!selectedAsset || !selectionOutlineVisible) {
    return;
  }

  selectedAsset.traverse((child) => {
    if (!child.isMesh || child.userData.pickable === false) {
      return;
    }

    const maskMesh = new THREE.Mesh(child.geometry, selectionOutlineMaskMaterial);
    maskMesh.frustumCulled = false;
    maskMesh.userData.source = child;
    selectionOutlineMaskScene.add(maskMesh);
    selectionMaskMeshes.push(maskMesh);
  });
}

function syncSelectionOutlineMask() {
  for (const maskMesh of selectionMaskMeshes) {
    const source = maskMesh.userData.source;

    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(
      maskMesh.position,
      maskMesh.quaternion,
      maskMesh.scale
    );
    maskMesh.visible = source.visible;
  }
}

function updateSelectionFeedback() {
  const hasSelection = Boolean(selectedAsset);

  transformControls.visible = hasSelection && transformGizmoVisible;
  transformControls.enabled = hasSelection && transformGizmoVisible && !cameraDragState;
  rebuildSelectionOutlineMask();
}

function selectAsset(asset) {
  selectedAsset = asset;
  transformToolbar.hidden = !selectedAsset;

  if (selectedAsset) {
    transformControls.attach(selectedAsset);
  } else {
    transformControls.detach();
  }

  updateSelectionFeedback();
  render();
}

function getPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getTransformPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    button: event.button
  };
}

function prepareTransformDuplicate(event) {
  duplicateOnTransformDrag = false;

  if (
    event.button !== 0 ||
    !event.altKey ||
    !selectedAsset ||
    !transformGizmoVisible ||
    !transformControls.visible ||
    !transformControls.enabled ||
    cameraDragState ||
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
    event.button !== 0 ||
    dragState ||
    cameraDragState ||
    isTransformDragging ||
    transformControls.dragging
  ) {
    return;
  }

  const hitAsset = asset;
  selectAsset(hitAsset);
}

function getGroundPoint(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();

  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
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

function beginAssetDrag(event) {
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

  dragPreview.innerHTML = button.innerHTML;
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
  dragPreview.innerHTML = "";
  dragState = null;
}

function updateCameraRotation() {
  lookDirection.set(
    Math.cos(pitch) * Math.cos(yaw),
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch)
  );
  camera.lookAt(camera.position.clone().add(lookDirection));
}

function syncRotationFromCamera() {
  camera.getWorldDirection(forward);
  yaw = Math.atan2(forward.y, forward.x);
  pitch = Math.asin(THREE.MathUtils.clamp(forward.z, -1, 1));
}

function moveCamera(distance) {
  camera.getWorldDirection(forward);
  camera.position.addScaledVector(forward, distance);
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
  syncRotationFromCamera();
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

function cameraNavigationBlocked() {
  return dragState || isTransformDragging || transformControls.dragging;
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

function handleViewportPointerDown(event) {
  if (cameraNavigationBlocked() || event.button < 0 || event.button > 2) {
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

function handleViewportPointerMove(event) {
  syncMouseButtons(event);

  if (cameraNavigationBlocked()) {
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

function handleViewportPointerUp(event) {
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

function render() {
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  if (!selectedAsset || !selectionOutlineVisible || selectionMaskMeshes.length === 0) {
    return;
  }

  syncSelectionOutlineMask();
  renderer.getClearColor(previousClearColor);
  const previousClearAlpha = renderer.getClearAlpha();

  renderer.setRenderTarget(selectionOutlineTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(selectionOutlineMaskScene, camera);
  renderer.setRenderTarget(null);
  renderer.setClearColor(previousClearColor, previousClearAlpha);
  renderer.clearDepth();
  const previousAutoClear = renderer.autoClear;

  renderer.autoClear = false;
  renderer.render(selectionOutlineCompositeScene, selectionOutlineCamera);
  renderer.autoClear = previousAutoClear;
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  selectionOutlineTarget.setSize(window.innerWidth, window.innerHeight);
  selectionOutlineTexelSize.set(1 / window.innerWidth, 1 / window.innerHeight);
  render();
}

function updateMovement(deltaTime) {
  if (!mouseButtons.right || keys.size === 0 || isTransformDragging) {
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

function tick(time) {
  const deltaTime = Math.min((time - lastFrameTime) / 1000 || 0, 0.05);
  lastFrameTime = time;

  if (updateMovement(deltaTime)) {
    render();
  }
}

function zoomView(event) {
  event.preventDefault();

  if (mouseButtons.right) {
    const speedScale = event.deltaY < 0 ? 1.12 : 0.88;
    cameraMoveSpeed = THREE.MathUtils.clamp(
      cameraMoveSpeed * speedScale,
      minCameraMoveSpeed,
      maxCameraMoveSpeed
    );
    return;
  }

  moveCamera(-event.deltaY * 0.02);
  render();
}

function pressKey(event) {
  const code = event.code.toLowerCase();

  if ((event.ctrlKey || event.metaKey) && code === "keyz" && !isTransformDragging) {
    event.preventDefault();
    undoLastAction();
    return;
  }

  if (
    (code === "delete" || code === "backspace") &&
    selectedAsset &&
    !mouseButtons.right &&
    !isTransformDragging &&
    !cameraDragState
  ) {
    event.preventDefault();
    deleteSelectedAsset();
    return;
  }

  if (!mouseButtons.right && selectedAsset) {
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

    if (code === "keyw") {
      event.preventDefault();
      setTransformMode("translate");
      return;
    }

    if (code === "keye") {
      event.preventDefault();
      setTransformMode("rotate");
      return;
    }

    if (code === "keyr") {
      event.preventDefault();
      setTransformMode("scale");
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

  if (!mouseButtons.right) {
    return;
  }

  event.preventDefault();
  keys.add(code);
}

function releaseKey(event) {
  keys.delete(event.code.toLowerCase());
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", pressKey);
window.addEventListener("keyup", releaseKey);
window.addEventListener("blur", () => {
  keys.clear();
  mouseButtons.left = false;
  mouseButtons.middle = false;
  mouseButtons.right = false;
  pendingClick = null;
  finishCameraDrag();
});
window.addEventListener("contextmenu", (event) => event.preventDefault());
assetToolbar.addEventListener("pointerdown", beginAssetDrag);
window.addEventListener("pointermove", moveAssetDrag);
window.addEventListener("pointerup", endAssetDrag);
window.addEventListener("pointercancel", endAssetDrag);
transformToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-transform-mode]");

  if (button) {
    setTransformMode(button.dataset.transformMode);
  }
});
renderer.domElement.addEventListener("pointerdown", prepareTransformDuplicate, true);
renderer.domElement.addEventListener("pointerdown", handleViewportPointerDown);
renderer.domElement.addEventListener("pointermove", handleViewportPointerMove);
renderer.domElement.addEventListener("pointerup", handleViewportPointerUp);
renderer.domElement.addEventListener("pointercancel", handleViewportPointerUp);
renderer.domElement.addEventListener("wheel", zoomView, { passive: false });
renderer.setAnimationLoop(tick);
syncRotationFromCamera();
render();
