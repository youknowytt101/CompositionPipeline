import * as THREE from "three";

export function createCube({ cubeSizeMeters, defaultAssetColor }) {
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

export function createSphere({ defaultAssetColor }) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 18),
    new THREE.MeshStandardMaterial({ color: defaultAssetColor, roughness: 0.62 })
  );

  mesh.position.z = 0.55;
  return mesh;
}

export function createCharacter({ defaultAssetColor }) {
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
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
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
