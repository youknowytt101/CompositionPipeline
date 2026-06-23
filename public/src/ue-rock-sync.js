const centimetersPerSceneUnit = 100;
const defaultAssetsBaseUrl = "/ue-sync/meshes/";
const defaultSceneManifestUrl = "/ue-sync/scene.manifest.json";
const defaultLegacyManifestUrl = "/ue-sync/rocks.instances.json";
const defaultSemanticRulesUrl = "/ue-sync/semantic.rules.json";
const unclassifiedSemantic = "unclassified";
const defaultSemanticClasses = {
  unclassified: { id: 0, color: "#ff00ff" }
};
export const defaultImportedModelFaceReductionRatio = 0.85;
const importedToonGradientMaps = new WeakMap();

export function ueCentimetersToSceneUnits(value) {
  return Number(value || 0) / centimetersPerSceneUnit;
}

function normalizeVector(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return fallback.map((fallbackValue, index) => {
    const nextValue = Number(value[index]);
    return Number.isFinite(nextValue) ? nextValue : fallbackValue;
  });
}

function normalizeMatrix(value) {
  if (!Array.isArray(value) || value.length !== 16) {
    return null;
  }

  const matrix = value.map(Number);
  return matrix.every(Number.isFinite) ? matrix : null;
}

function normalizeQuaternion(value) {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }

  const quaternion = value.map(Number);
  return quaternion.every(Number.isFinite) ? quaternion : null;
}

export function convertUnrealQuaternionToSceneQuaternion(value) {
  const quaternion = normalizeQuaternion(value) || [0, 0, 0, 1];

  return {
    x: -quaternion[0],
    y: quaternion[1],
    z: -quaternion[2],
    w: quaternion[3]
  };
}

export function createGltfStaticMeshBasisRotation() {
  return {
    x: Math.PI / 2,
    y: 0,
    z: 0,
    order: "XYZ"
  };
}

function normalizeMeshInstance(input, index, fallbackId) {
  if (!input?.mesh) {
    throw new Error(`UE rock sync instance ${index + 1} is missing mesh`);
  }

  return {
    id: input.id || fallbackId || `ue-rock-component-${index + 1}`,
    mesh: input.mesh,
    meshAssetPath: input.meshAssetPath || null,
    location: normalizeVector(input.location, [0, 0, 0]),
    rotation: normalizeVector(input.rotation, [0, 0, 0]),
    quaternion: normalizeQuaternion(input.quaternion),
    scale: normalizeVector(input.scale, [1, 1, 1]),
    sceneMatrix: normalizeMatrix(input.sceneMatrix)
  };
}

function normalizeTransformRecord(transform = {}) {
  return {
    location: normalizeVector(transform.location, [0, 0, 0]),
    rotation: normalizeVector(transform.rotation, [0, 0, 0]),
    quaternion: normalizeQuaternion(transform.quaternion),
    scale: normalizeVector(transform.scale, [1, 1, 1]),
    sceneMatrix: normalizeMatrix(transform.sceneMatrix)
  };
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? value.map((item) => `${item}`).filter(Boolean)
    : [];
}

function normalizeTerrainSize(value, extent) {
  if (Array.isArray(value)) {
    const width = Number(value[0]);
    const depth = Number(value[1]);

    if (Number.isFinite(width) && Number.isFinite(depth)) {
      return [width, depth];
    }
  }

  return [Math.max(0, extent[0] * 2), Math.max(0, extent[1] * 2)];
}

function normalizeTerrainRecord(value = {}) {
  const center = normalizeVector(value.center, [0, 0, 0]);
  const extent = normalizeVector(value.extent, [0, 0, 0]);

  return {
    center,
    extent,
    size: normalizeTerrainSize(value.size, extent)
  };
}

function isTerrainComponentInput(input) {
  return Boolean(input?.terrain) || /Landscape|Terrain/i.test(`${input?.type || ""}`);
}

function normalizeOptionalNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeSceneComponent(input, index, actor) {
  const terrain = isTerrainComponentInput(input) ? normalizeTerrainRecord(input.terrain || input) : null;

  if (!input?.mesh && !terrain) {
    throw new Error(`UE scene component ${index + 1} is missing mesh`);
  }

  const transform = normalizeTransformRecord(input.transform || (terrain ? { location: terrain.center } : input));
  const colorId = normalizeOptionalNumber(input.colorId);

  // Minimal manifest only needs id / mesh / transform / semantic. The remaining
  // classification fields are OPTIONAL: kept (with empty defaults) so the
  // browser-side semantic rule engine still works if a manifest provides them.
  return {
    id: input.id || `${actor.id}-component-${index + 1}`,
    label: input.label || input.name || `Component ${index + 1}`,
    name: input.name || input.label || `Component ${index + 1}`,
    type: input.type || "StaticMeshComponent",
    mesh: input.mesh || null,
    meshAssetPath: input.meshAssetPath || null,
    terrain,
    materialSlots: normalizeStringList(input.materialSlots),
    tags: normalizeStringList(input.tags),
    semantic: input.semantic || actor.semantic || unclassifiedSemantic,
    colorId: colorId ?? actor.colorId,
    sourceMetadata: input.sourceMetadata || {},
    ...transform
  };
}

function normalizeSceneActor(input, index) {
  const actorId = input?.id || `ue-scene-actor-${index + 1}`;
  const colorId = normalizeOptionalNumber(input?.colorId);
  const transform = normalizeTransformRecord(input?.transform || input);
  const actor = {
    id: actorId,
    label: input?.label || actorId,
    class: input?.class || input?.className || "",
    folderPath: input?.folderPath || "",
    tags: normalizeStringList(input?.tags),
    semantic: input?.semantic || unclassifiedSemantic,
    colorId,
    mesh: null,
    meshAssetPath: null,
    children: [],
    source: "unreal-scene-actor",
    sourceMetadata: input?.sourceMetadata || {},
    ...transform
  };
  const components = Array.isArray(input?.components) ? input.components : [];

  actor.children = components.map((component, componentIndex) => normalizeSceneComponent(component, componentIndex, actor));
  return actor;
}

export function normalizeRockSyncManifest(input = {}) {
  const instances = Array.isArray(input.instances) ? input.instances : [];

  return {
    assetsBaseUrl: input.assetsBaseUrl || defaultAssetsBaseUrl,
    instances: instances.map((instance, index) => {
      const children = Array.isArray(instance.children) ? instance.children : [];

      return {
        id: instance.id || `ue-rock-${index + 1}`,
        mesh: instance.mesh || null,
        meshAssetPath: instance.meshAssetPath || null,
        location: normalizeVector(instance.location, [0, 0, 0]),
        rotation: normalizeVector(instance.rotation, [0, 0, 0]),
        quaternion: normalizeQuaternion(instance.quaternion),
        scale: normalizeVector(instance.scale, [1, 1, 1]),
        sceneMatrix: normalizeMatrix(instance.sceneMatrix),
        children: children.length
          ? children.map((child, childIndex) => normalizeMeshInstance(
            child,
            childIndex,
            `${instance.id || `ue-rock-${index + 1}`}-component-${childIndex + 1}`
          ))
          : instance.mesh
            ? []
            : (() => {
              throw new Error(`UE rock sync instance ${index + 1} is missing mesh`);
            })()
      };
    })
  };
}

export function normalizeSceneSyncManifest(input = {}) {
  if (Array.isArray(input.instances) && !Array.isArray(input.actors)) {
    return {
      ...normalizeRockSyncManifest(input),
      schema: input.schema || "composition-pipeline.ue-rock-sync.v1",
      sceneOrigin: normalizeVector(input.sceneOrigin, [0, 0, 0]),
      gridSizeMeters: Number(input.gridSizeMeters) || null,
      semanticRulesUrl: input.semanticRulesUrl || defaultSemanticRulesUrl
    };
  }

  const actors = Array.isArray(input.actors) ? input.actors : [];

  return {
    schema: input.schema || "composition-pipeline.ue-scene.v2",
    assetsBaseUrl: input.assetsBaseUrl || defaultAssetsBaseUrl,
    sceneOrigin: normalizeVector(input.sceneOrigin, [0, 0, 0]),
    gridSizeMeters: Number(input.gridSizeMeters) || null,
    semanticRulesUrl: input.semanticRulesUrl || defaultSemanticRulesUrl,
    instances: actors.map(normalizeSceneActor)
  };
}

export function normalizeSemanticRules(input = {}) {
  const classes = {
    ...defaultSemanticClasses,
    ...(input.classes || {})
  };
  const rules = Array.isArray(input.rules)
    ? input.rules.filter((rule) => rule?.if && rule.semantic)
    : [];

  return { classes, rules };
}

function textContains(haystack, needle) {
  return `${haystack || ""}`.toLowerCase().includes(`${needle || ""}`.toLowerCase());
}

function semanticMatchesRule(metadata, rule) {
  const conditions = rule.if || {};

  return Object.entries(conditions).every(([key, expected]) => {
    if (key === "assetPathContains") {
      return textContains(metadata.meshAssetPath, expected);
    }

    if (key === "blueprintClassContains") {
      return textContains(metadata.actorClass, expected);
    }

    if (key === "actorLabelContains") {
      return textContains(metadata.actorLabel, expected);
    }

    if (key === "componentNameContains") {
      return textContains(metadata.componentName, expected);
    }

    if (key === "materialContains") {
      return textContains((metadata.materialSlots || []).join(" "), expected);
    }

    if (key === "folderPathContains") {
      return textContains(metadata.folderPath, expected);
    }

    if (key === "tagContains") {
      return (metadata.tags || []).some((tag) => textContains(tag, expected));
    }

    return false;
  });
}

function semanticForMetadata(metadata, semanticRules) {
  if (metadata.semantic && metadata.semantic !== unclassifiedSemantic) {
    return metadata.semantic;
  }

  const rule = semanticRules.rules.find((candidate) => semanticMatchesRule(metadata, candidate));

  return rule?.semantic || unclassifiedSemantic;
}

export function createSceneTransformFromUnrealInstance(instance, {
  scaleMode = "mesh",
  sceneOrigin = [0, 0, 0]
} = {}) {
  const [x, y, z] = normalizeVector(instance.location, [0, 0, 0]);
  const [originX, originY, originZ] = normalizeVector(sceneOrigin, [0, 0, 0]);
  const [roll, pitch, yaw] = normalizeVector(instance.rotation, [0, 0, 0]);
  const [scaleX, scaleY, scaleZ] = normalizeVector(instance.scale, [1, 1, 1]);
  const scaleUnit = scaleMode === "unitless" ? 1 : (1 / centimetersPerSceneUnit);

  return {
    position: {
      x: ueCentimetersToSceneUnits(x - originX),
      y: -ueCentimetersToSceneUnits(y - originY),
      z: ueCentimetersToSceneUnits(z - originZ)
    },
    quaternion: instance.quaternion
      ? convertUnrealQuaternionToSceneQuaternion(instance.quaternion)
      : null,
    rotation: {
      x: -roll * Math.PI / 180,
      y: pitch * Math.PI / 180,
      z: -yaw * Math.PI / 180,
      order: "XYZ"
    },
    scale: {
      x: scaleX * scaleUnit,
      y: scaleY * scaleUnit,
      z: scaleZ * scaleUnit
    }
  };
}

function joinUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) {
    return path;
  }

  return `${baseUrl.replace(/\/?$/, "/")}${path}`;
}

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function disposeObjectMaterials(object) {
  object.traverse?.((child) => {
    if (!child.isMesh) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material?.userData?.ueSyncCachedMaterial) {
        material?.dispose?.();
      }
    });
  });
}

function getImportedToonGradientMap(THREE) {
  if (importedToonGradientMaps.has(THREE)) {
    return importedToonGradientMaps.get(THREE);
  }

  if (!THREE.DataTexture) {
    const fallbackMap = { kind: "toon-gradient" };
    importedToonGradientMaps.set(THREE, fallbackMap);
    return fallbackMap;
  }

  const stops = new Uint8Array([70, 160, 240]);
  const map = new THREE.DataTexture(stops, stops.length, 1, THREE.RedFormat);
  map.minFilter = THREE.NearestFilter;
  map.magFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  map.kind = "toon-gradient";
  importedToonGradientMaps.set(THREE, map);
  return map;
}

function createImportedToonMaterial(THREE, color) {
  if (!THREE.MeshToonMaterial) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0.02
    });
  }

  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getImportedToonGradientMap(THREE)
  });
}

function applyGrayModelMaterial(object, THREE) {
  const material = createImportedToonMaterial(THREE, 0x9b9b9b);

  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    disposeObjectMaterials(child);
    child.material = material;
    child.castShadow = true;
    child.receiveShadow = false;
    child.userData.pickable = true;
  });
}

function createWeldedSimplificationGeometry(geometry, mergeVertices) {
  const workingGeometry = geometry.clone?.();

  if (!workingGeometry) {
    return null;
  }

  Object.keys(workingGeometry.attributes || {}).forEach((attributeName) => {
    if (attributeName !== "position") {
      workingGeometry.deleteAttribute?.(attributeName);
    }
  });
  workingGeometry.morphAttributes = {};
  workingGeometry.clearGroups?.();

  if (!mergeVertices) {
    return workingGeometry;
  }

  const weldedGeometry = mergeVertices(workingGeometry);

  if (weldedGeometry && weldedGeometry !== workingGeometry) {
    workingGeometry.dispose?.();
    return weldedGeometry;
  }

  return workingGeometry;
}

function simplifyMeshGeometry(mesh, simplifyModifier, reductionRatio, mergeVertices) {
  const geometry = mesh.geometry;
  const sourceVertexCount = geometry?.attributes?.position?.count ?? 0;

  if (!simplifyModifier || sourceVertexCount < 4) {
    return;
  }

  const simplificationGeometry = createWeldedSimplificationGeometry(geometry, mergeVertices);
  const vertexCount = simplificationGeometry?.attributes?.position?.count ?? 0;
  const removeCount = Math.floor(vertexCount * reductionRatio);

  if (removeCount < 1) {
    simplificationGeometry?.dispose?.();
    return;
  }

  const simplifiedGeometry = simplifyModifier.modify(simplificationGeometry, removeCount);

  if (!simplifiedGeometry) {
    simplificationGeometry.dispose?.();
    return;
  }

  simplifiedGeometry.computeVertexNormals?.();
  simplificationGeometry.dispose?.();
  geometry.dispose?.();
  mesh.geometry = simplifiedGeometry;
}

export function optimizeImportedGrayModel(object, {
  THREE,
  simplifyModifier = null,
  reductionRatio = defaultImportedModelFaceReductionRatio,
  mergeVertices = null
}) {
  object.traverse((child) => {
    if (child.isMesh) {
      simplifyMeshGeometry(child, simplifyModifier, reductionRatio, mergeVertices);
    }
  });

  applyGrayModelMaterial(object, THREE);
}

function applyGltfStaticMeshBasis(object) {
  const basisRotation = createGltfStaticMeshBasisRotation();
  object.rotation.set(basisRotation.x, basisRotation.y, basisRotation.z, basisRotation.order);
}

function markSyncedAssetRoot(object) {
  const assetId = object.userData.assetId;
  const assetType = object.userData.assetType;

  object.userData.assetRoot = object;
  object.userData.pickable = true;
  object.traverse((child) => {
    child.userData.assetRoot = object;
    child.userData.assetId = assetId;
    child.userData.assetType = assetType;

    if (child.isMesh) {
      child.userData.pickable = true;
    }
  });
}

function copyImportedMetadata(object, metadata) {
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined) {
      object.userData[key] = value;
    }
  });
}

function semanticMetadataForInstance(instance, actor) {
  return {
    semantic: instance.semantic,
    colorId: instance.colorId,
    meshAssetPath: instance.meshAssetPath,
    actorClass: actor?.class || instance.class || "",
    actorLabel: actor?.label || instance.label || instance.id,
    componentName: instance.name || instance.label || instance.id,
    folderPath: actor?.folderPath || instance.folderPath || "",
    materialSlots: normalizeStringList(instance.materialSlots),
    tags: [
      ...normalizeStringList(actor?.tags),
      ...normalizeStringList(instance.tags)
    ]
  };
}

function applySceneTransform(object, instance, THREE, {
  scaleMode = "mesh",
  sceneOrigin = [0, 0, 0]
} = {}) {
  if (instance.sceneMatrix) {
    const matrix = new THREE.Matrix4().fromArray(instance.sceneMatrix);
    matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }

  const transform = createSceneTransformFromUnrealInstance(instance, { scaleMode, sceneOrigin });
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  if (transform.quaternion) {
    object.quaternion.set(
      transform.quaternion.x,
      transform.quaternion.y,
      transform.quaternion.z,
      transform.quaternion.w
    );
  } else {
    object.rotation.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.order
    );
  }
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}

export function createUnrealRockSyncController({
  THREE,
  scene,
  loader,
  simplifyModifier = null,
  mergeVertices = null,
  reductionRatio = defaultImportedModelFaceReductionRatio,
  manifestUrl = defaultSceneManifestUrl,
  fallbackManifestUrl = defaultLegacyManifestUrl,
  semanticRulesUrl = defaultSemanticRulesUrl,
  fetchJson = (url) => fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }),
  onStatusChange = () => {},
  onSynced = () => {},
  render = () => {}
}) {
  const group = new THREE.Group();
  const meshCache = new Map();
  const semanticMaterials = new Map();
  let displayMode = "gray";
  let semanticRules = normalizeSemanticRules();
  let activeManifestSource = manifestUrl;
  const grayMaterial = createImportedToonMaterial(THREE, 0x9b9b9b);

  grayMaterial.userData = {
    ...(grayMaterial.userData || {}),
    ueSyncCachedMaterial: true
  };

  group.name = "ue-rock-sync";
  group.userData.pickable = false;
  scene.add(group);

  function setStatus(status) {
    onStatusChange({
      source: activeManifestSource,
      count: group.children.length,
      ...status
    });
  }

  function clear() {
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
      disposeObjectMaterials(child);
    }
  }

  async function getTemplate(baseUrl, meshPath) {
    const url = joinUrl(baseUrl, meshPath);

    if (!meshCache.has(url)) {
      meshCache.set(url, loadGltf(loader, url).then((gltf) => gltf.scene));
    }

    return meshCache.get(url);
  }

  async function fetchManifestWithFallback() {
    try {
      activeManifestSource = manifestUrl;
      return await fetchJson(manifestUrl);
    } catch (error) {
      if (!fallbackManifestUrl) {
        throw error;
      }

      activeManifestSource = fallbackManifestUrl;
      return fetchJson(fallbackManifestUrl);
    }
  }

  async function loadSemanticRules(url) {
    try {
      semanticRules = normalizeSemanticRules(await fetchJson(url || semanticRulesUrl));
    } catch {
      semanticRules = normalizeSemanticRules();
    }
  }

  function materialForSemanticMetadata(metadata) {
    const semantic = semanticForMetadata(metadata, semanticRules);
    const semanticClass = semanticRules.classes[semantic] || semanticRules.classes[unclassifiedSemantic];
    const color = semanticClass?.color || defaultSemanticClasses.unclassified.color;
    const colorId = normalizeOptionalNumber(semanticClass?.id) ?? normalizeOptionalNumber(metadata.colorId);
    const cacheKey = `${semantic}:${color}`;

    metadata.semantic = semantic;
    metadata.colorId = colorId;

    if (!semanticMaterials.has(cacheKey)) {
      const material = createImportedToonMaterial(THREE, color);

      material.userData = {
        ...(material.userData || {}),
        ueSyncCachedMaterial: true
      };
      semanticMaterials.set(cacheKey, material);
    }

    return semanticMaterials.get(cacheKey);
  }

  function applyMaterialModeToMesh(mesh) {
    const metadata = mesh.userData.ueSyncSemanticMetadata || {};
    const material = displayMode === "semanticColor"
      ? materialForSemanticMetadata(metadata)
      : grayMaterial;

    mesh.userData.semantic = metadata.semantic;
    mesh.userData.colorId = metadata.colorId;
    mesh.material = material;
  }

  function applyDisplayMode(root = group) {
    root.traverse?.((child) => {
      if (child.isMesh) {
        applyMaterialModeToMesh(child);
      }
    });
  }

  function setMeshSemanticMetadata(object, metadata) {
    object.traverse?.((child) => {
      if (!child.isMesh) {
        return;
      }

      child.userData.ueSyncSemanticMetadata = metadata;
      child.userData.semantic = metadata.semantic;
      child.userData.colorId = metadata.colorId;
    });
  }

  function createTerrainProxyObject(terrainInstance, metadata) {
    const terrain = terrainInstance.terrain || normalizeTerrainRecord();
    const width = Math.max(ueCentimetersToSceneUnits(terrain.size[0]), 0.01);
    const depth = Math.max(ueCentimetersToSceneUnits(terrain.size[1]), 0.01);
    const geometry = new THREE.PlaneGeometry(width, depth, 4, 4);
    const mesh = new THREE.Mesh(geometry, grayMaterial);

    mesh.name = `${terrainInstance.id || "terrain"}-proxy`;
    mesh.userData.ueSyncTerrain = terrain;
    mesh.userData.pickable = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    setMeshSemanticMetadata(mesh, metadata);
    applyMaterialModeToMesh(mesh);
    return mesh;
  }

  async function sync() {
    activeManifestSource = manifestUrl;
    setStatus({ state: "syncing", message: "Syncing UE scene..." });

    try {
      const manifest = normalizeSceneSyncManifest(await fetchManifestWithFallback());
      const isSceneManifest = manifest.schema === "composition-pipeline.ue-scene.v2";
      const assetType = isSceneManifest ? "ue-scene-actor" : "ue-rock";

      await loadSemanticRules(manifest.semanticRulesUrl || semanticRulesUrl);
      clear();

      for (const instance of manifest.instances) {
        const object = new THREE.Group();
        const meshInstances = instance.children.length ? instance.children : [instance];
        const hasChildMeshes = instance.children.length > 0;

        object.name = instance.id;
        object.userData.assetId = instance.id;
        object.userData.assetType = assetType;
        // Minimal manifest only carries label (display), semantic and colorId.
        copyImportedMetadata(object, {
          label: instance.label,
          semantic: instance.semantic,
          colorId: instance.colorId
        });
        if (hasChildMeshes) {
          applySceneTransform(object, instance, THREE, {
            scaleMode: "unitless",
            sceneOrigin: manifest.sceneOrigin
          });
          object.updateMatrixWorld?.(true);
        }

        for (const meshInstance of meshInstances) {
          const semanticMetadata = semanticMetadataForInstance(meshInstance, instance);
          let meshObject = null;

          if (meshInstance.terrain) {
            meshObject = createTerrainProxyObject(meshInstance, semanticMetadata);
          } else {
            const template = await getTemplate(manifest.assetsBaseUrl, meshInstance.mesh);

            meshObject = template.clone(true);
            applyGltfStaticMeshBasis(meshObject);
            optimizeImportedGrayModel(meshObject, { THREE, simplifyModifier, mergeVertices, reductionRatio });
            setMeshSemanticMetadata(meshObject, semanticMetadata);
          }

          meshObject.name = `${meshInstance.id || instance.id}-mesh`;

          if (meshInstance !== instance) {
            const componentObject = new THREE.Group();

            componentObject.name = meshInstance.id || `${instance.id}-component`;
            copyImportedMetadata(componentObject, {
              label: meshInstance.label,
              semantic: semanticMetadata.semantic,
              colorId: semanticMetadata.colorId
            });
            applySceneTransform(componentObject, meshInstance, THREE, {
              scaleMode: "mesh",
              sceneOrigin: manifest.sceneOrigin
            });
            componentObject.add(meshObject);
            componentObject.updateMatrixWorld?.(true);
            object.attach(componentObject);
          } else {
            object.add(meshObject);
          }
        }

        markSyncedAssetRoot(object);
        if (!hasChildMeshes) {
          applySceneTransform(object, instance, THREE, {
            scaleMode: "mesh",
            sceneOrigin: manifest.sceneOrigin
          });
        }
        group.add(object);
      }

      applyDisplayMode();
      setStatus({
        state: "ready",
        message: `Synced ${manifest.instances.length} UE scene actors`,
        count: manifest.instances.length
      });
      onSynced(manifest);
      render();
      return manifest;
    } catch (error) {
      setStatus({
        state: "error",
        message: `UE rock sync failed: ${error.message || error}`
      });
      throw error;
    }
  }

  setStatus({ state: "idle", message: "Ready to sync UE rocks" });

  return {
    clear,
    group,
    getDisplayMode: () => displayMode,
    setDisplayMode(mode) {
      displayMode = mode === "semanticColor" ? "semanticColor" : "gray";
      applyDisplayMode();
      render();
    },
    sync
  };
}
