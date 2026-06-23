import * as THREE from "three";

// 3-step toon gradient ramp (dark / mid / light), shared by toon assets.
let sharedToonGradientMap = null;
function getToonGradientMap() {
  if (sharedToonGradientMap) {
    return sharedToonGradientMap;
  }

  // Three luminance stops -> three flat shading bands (dark / mid / light).
  const stops = new Uint8Array([70, 160, 240]);
  const map = new THREE.DataTexture(stops, stops.length, 1, THREE.RedFormat);
  map.minFilter = THREE.NearestFilter;
  map.magFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  sharedToonGradientMap = map;
  return map;
}

// Default gray-model toon material: flat 3-step ramp only.
// No rim/specular -> the surface reads as pure flat cel shading.
function createToonGrayMaterial(color = 0x9a9a9a) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap()
  });
}

// Inverted-hull outline: back-face shell whose vertices are pushed out ALONG
// their normals by a constant world-space thickness. Uniform line width on any
// shape/size, and seams stay closed (unlike a uniform scale).
function createOutlineMaterial(thickness = 0.012) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      outlineColor: { value: new THREE.Color(0x141414) },
      outlineThickness: { value: thickness }
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 pushed = position + normalize(normal) * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pushed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `
  });
  return material;
}

function createOutlineMesh(geometry, thickness = 0.012) {
  const outline = new THREE.Mesh(geometry, createOutlineMaterial(thickness));
  outline.userData.pickable = false;
  outline.userData.outline = true;
  return outline;
}

export function createCube({ cubeSizeMeters }) {
  const geometry = new THREE.BoxGeometry(cubeSizeMeters, cubeSizeMeters, cubeSizeMeters);
  const mesh = new THREE.Mesh(geometry, createToonGrayMaterial());

  // ~12mm world-space outline on a 1m cube.
  const outline = createOutlineMesh(geometry, 0.012);

  mesh.add(outline);
  mesh.position.z = cubeSizeMeters / 2;
  return mesh;
}

export function createSphere() {
  const geometry = new THREE.SphereGeometry(0.55, 48, 32);
  const mesh = new THREE.Mesh(geometry, createToonGrayMaterial());

  // Fine contour line on a 0.55r sphere.
  const outline = createOutlineMesh(geometry, 0.012);

  mesh.add(outline);
  mesh.position.z = 0.55;
  return mesh;
}

export function createCharacter() {
  const group = new THREE.Group();

  // One toon material instance shared across the body parts.
  const toon = createToonGrayMaterial();
  const bodyGeometry = new THREE.CapsuleGeometry(0.28, 0.85, 6, 14);
  const headGeometry = new THREE.SphereGeometry(0.26, 24, 16);
  const footGeometry = new THREE.BoxGeometry(0.24, 0.42, 0.12);

  const body = new THREE.Mesh(bodyGeometry, toon);
  const head = new THREE.Mesh(headGeometry, toon);
  const leftFoot = new THREE.Mesh(footGeometry, toon);
  const rightFoot = new THREE.Mesh(footGeometry, toon);

  body.add(createOutlineMesh(bodyGeometry, 0.012));
  head.add(createOutlineMesh(headGeometry, 0.012));
  leftFoot.add(createOutlineMesh(footGeometry, 0.01));
  rightFoot.add(createOutlineMesh(footGeometry, 0.01));

  body.rotation.x = Math.PI / 2;
  body.position.z = 0.82;
  head.position.z = 1.54;
  leftFoot.position.set(-0.16, 0.04, 0.06);
  rightFoot.position.set(0.16, 0.04, 0.06);
  group.add(body, head, leftFoot, rightFoot);
  return group;
}

export function createSunLight() {
  const group = new THREE.Group();
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd45a,
    toneMapped: false
  });
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0xffd45a,
    transparent: true,
    opacity: 0.82
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), markerMaterial);
  const rays = new THREE.Group();
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
  const lightTarget = new THREE.Object3D();

  marker.position.z = 1.8;
  marker.userData.lightHelper = true;

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const inner = new THREE.Vector3(Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 1.8);
    const outer = new THREE.Vector3(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 1.8);
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([inner, outer]), rayMaterial);

    ray.userData.pickable = false;
    ray.userData.lightHelper = true;
    rays.add(ray);
  }

  directionalLight.position.set(0, 0, 4);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 80;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  directionalLight.shadow.bias = -0.0005;

  lightTarget.position.set(0, -5, 0);
  directionalLight.target = lightTarget;

  group.add(marker, rays, directionalLight, lightTarget);
  group.userData.sunLight = directionalLight;
  group.userData.sunLightTarget = lightTarget;
  return group;
}

export function createAsset(type, options) {
  if (type === "cube") {
    return createCube(options);
  }

  if (type === "sphere") {
    return createSphere(options);
  }

  if (type === "sun-light") {
    return createSunLight(options);
  }

  return createCharacter(options);
}

export function getAssetGridOffset(assetOrType, { cubeSizeMeters }) {
  const type = typeof assetOrType === "string"
    ? assetOrType
    : assetOrType.userData.assetType;

  return type === "cube" ? cubeSizeMeters / 2 : 0;
}
