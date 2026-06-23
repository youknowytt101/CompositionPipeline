import assert from "node:assert/strict";

import {
  defaultImportedModelFaceReductionRatio,
  createGltfStaticMeshBasisRotation,
  createSceneTransformFromUnrealInstance,
  createUnrealRockSyncController,
  convertUnrealQuaternionToSceneQuaternion,
  normalizeSceneSyncManifest,
  normalizeSemanticRules,
  optimizeImportedGrayModel,
  normalizeRockSyncManifest,
  ueCentimetersToSceneUnits
} from "../public/src/ue-rock-sync.js";

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.000001, message || `${actual} !== ${expected}`);
}

assert.equal(ueCentimetersToSceneUnits(250), 2.5);
assert.equal(ueCentimetersToSceneUnits(-75), -0.75);

const manifest = normalizeRockSyncManifest({
  assetsBaseUrl: "/ue-sync/meshes/",
  instances: [
    {
      id: "Rock_A_01",
      mesh: "SM_Rock_A.glb",
      location: [100, -200, 50],
      rotation: [0, 0, 90],
      quaternion: [0, 0, 0.7071068, 0.7071068],
      scale: [2, 1, 0.5]
    }
  ]
});

assert.equal(manifest.assetsBaseUrl, "/ue-sync/meshes/");
assert.equal(manifest.instances.length, 1);
assert.deepEqual(manifest.instances[0].location, [100, -200, 50]);
assert.equal(manifest.instances[0].children.length, 0);

const blueprintManifest = normalizeRockSyncManifest({
  instances: [
    {
      id: "BP_RockCluster",
      location: [1000, 0, 0],
      rotation: [0, 0, 0],
      scale: [100, 100, 100],
      children: [
        {
          id: "BP_RockCluster_SM_1",
          mesh: "SM_Rock_A.glb",
          location: [10, 0, 0],
          rotation: [0, 0, 45],
          scale: [100, 100, 100]
        },
        {
          id: "BP_RockCluster_SM_2",
          mesh: "SM_Rock_B.glb",
          location: [-10, 0, 0],
          rotation: [0, 0, -45],
          scale: [100, 100, 100]
        }
      ]
    }
  ]
});

assert.equal(blueprintManifest.instances[0].mesh, null);
assert.equal(blueprintManifest.instances[0].children.length, 2);
assert.equal(blueprintManifest.instances[0].children[0].mesh, "SM_Rock_A.glb");

const sceneManifest = normalizeSceneSyncManifest({
  schema: "composition-pipeline.ue-scene.v2",
  assetsBaseUrl: "/ue-sync/meshes/",
  sceneOrigin: [1000, 2000, 0],
  gridSizeMeters: 5000,
  actors: [
    {
      id: "BP_Ruin_001",
      label: "Ruin Wall",
      class: "BP_RuinWall",
      folderPath: "Ruins/Wall",
      tags: ["ruin"],
      semantic: "human_made",
      colorId: 5,
      transform: {
        location: [1100, 1800, 50],
        quaternion: [0, 0, 0.7071068, 0.7071068],
        scale: [1, 1, 1]
      },
      components: [
        {
          id: "BP_Ruin_001_SM_1",
          name: "StaticMeshComponent0",
          type: "StaticMeshComponent",
          mesh: "SM_Ruin_proxy.glb",
          meshAssetPath: "/Game/Ruins/Wall/SM_Ruin",
          materialSlots: ["M_Stone"],
          tags: [],
          transform: {
            location: [1125, 1850, 50],
            quaternion: [0, 0, 0.7071068, 0.7071068],
            scale: [100, 100, 100]
          }
        }
      ]
    }
  ]
});

assert.equal(sceneManifest.schema, "composition-pipeline.ue-scene.v2");
assert.deepEqual(sceneManifest.sceneOrigin, [1000, 2000, 0]);
assert.equal(sceneManifest.gridSizeMeters, 5000);
assert.equal(sceneManifest.instances.length, 1);
assert.equal(sceneManifest.instances[0].id, "BP_Ruin_001");
assert.equal(sceneManifest.instances[0].children.length, 1);
assert.equal(sceneManifest.instances[0].children[0].mesh, "SM_Ruin_proxy.glb");
assert.equal(sceneManifest.instances[0].semantic, "human_made");
assert.equal(sceneManifest.instances[0].children[0].semantic, "human_made");

const terrainSceneManifest = normalizeSceneSyncManifest({
  schema: "composition-pipeline.ue-scene.v2",
  sceneOrigin: [5000, 10000, 0],
  actors: [
    {
      id: "LandscapeVillage",
      label: "Landscape Village",
      class: "Landscape",
      semantic: "terrain",
      colorId: 6,
      transform: {
        location: [5000, 10000, 0],
        scale: [1, 1, 1]
      },
      components: [
        {
          id: "LandscapeStreamingProxy_0_0",
          name: "LandscapeStreamingProxy_0_0",
          type: "LandscapeStreamingProxy",
          semantic: "terrain",
          colorId: 6,
          transform: {
            location: [5100, 9800, 25],
            scale: [1, 1, 1]
          },
          terrain: {
            center: [5100, 9800, 25],
            extent: [200, 300, 50],
            size: [400, 600]
          }
        }
      ]
    }
  ]
});

assert.equal(terrainSceneManifest.instances[0].semantic, "terrain");
assert.equal(terrainSceneManifest.instances[0].children.length, 1);
assert.equal(terrainSceneManifest.instances[0].children[0].mesh, null);
assert.equal(terrainSceneManifest.instances[0].children[0].type, "LandscapeStreamingProxy");
assert.deepEqual(terrainSceneManifest.instances[0].children[0].terrain.size, [400, 600]);

const rebasedActorTransform = createSceneTransformFromUnrealInstance(sceneManifest.instances[0], {
  sceneOrigin: sceneManifest.sceneOrigin,
  scaleMode: "unitless"
});
assert.deepEqual(rebasedActorTransform.position, { x: 1, y: 2, z: 0.5 });

const semanticRules = normalizeSemanticRules({
  classes: {
    tree: { id: 1, color: "#2f7d32" },
    shrub: { id: 2, color: "#57a65a" },
    grass: { id: 3, color: "#8bbf3d" },
    rock: { id: 4, color: "#8e8e8e" },
    human_made: { id: 5, color: "#d18b4b" },
    unclassified: { id: 0, color: "#ff00ff" }
  },
  rules: [
    { if: { blueprintClassContains: "Tree" }, semantic: "tree" },
    { if: { assetPathContains: "Bush" }, semantic: "shrub" },
    { if: { assetPathContains: "Grass" }, semantic: "grass" },
    { if: { assetPathContains: "Wall" }, semantic: "human_made" },
    { if: { assetPathContains: "Rock" }, semantic: "rock" }
  ]
});

assert.equal(semanticRules.classes.tree.id, 1);
assert.equal(semanticRules.classes.shrub.color, "#57a65a");
assert.equal(semanticRules.classes.grass.color, "#8bbf3d");
assert.equal(semanticRules.classes.rock.id, 4);
assert.equal(semanticRules.classes.human_made.color, "#d18b4b");
assert.equal(semanticRules.rules[0].semantic, "tree");
assert.equal(semanticRules.rules[3].semantic, "human_made");

assert.throws(
  () => normalizeRockSyncManifest({ instances: [{ id: "missing-mesh" }] }),
  /mesh/
);

const transform = createSceneTransformFromUnrealInstance(manifest.instances[0]);

assert.deepEqual(transform.position, { x: 1, y: 2, z: 0.5 });
assert.deepEqual(transform.quaternion, { x: -0, y: 0, z: -0.7071068, w: 0.7071068 });
assert.deepEqual(transform.scale, { x: 0.02, y: 0.01, z: 0.005 });
assert.equal(Math.round(transform.rotation.z * 1000) / 1000, Math.round((-Math.PI / 2) * 1000) / 1000);

const rollQuaternion = convertUnrealQuaternionToSceneQuaternion([0.7071068, 0, 0, 0.7071068]);
assertClose(rollQuaternion.x, -0.7071068, "UE positive roll should rotate around negative scene X");
assertClose(rollQuaternion.y, 0);
assertClose(rollQuaternion.z, 0);
assertClose(rollQuaternion.w, 0.7071068);

const pitchQuaternion = convertUnrealQuaternionToSceneQuaternion([0, 0.7071068, 0, 0.7071068]);
assertClose(pitchQuaternion.x, 0);
assertClose(pitchQuaternion.y, 0.7071068, "UE positive pitch should stay around positive mirrored scene Y");
assertClose(pitchQuaternion.z, 0);
assertClose(pitchQuaternion.w, 0.7071068);

const yawQuaternion = convertUnrealQuaternionToSceneQuaternion([0, 0, 0.7071068, 0.7071068]);
assertClose(yawQuaternion.x, 0);
assertClose(yawQuaternion.y, 0);
assertClose(yawQuaternion.z, -0.7071068, "UE positive yaw should rotate around negative scene Z after mirroring Y");
assertClose(yawQuaternion.w, 0.7071068);

const eulerFallback = createSceneTransformFromUnrealInstance({
  mesh: "SM_Rock_A.glb",
  location: [0, 0, 0],
  rotation: [15, 30, 90],
  scale: [1, 1, 1]
});

assertClose(eulerFallback.rotation.x, -15 * Math.PI / 180);
assertClose(eulerFallback.rotation.y, 30 * Math.PI / 180);
assertClose(eulerFallback.rotation.z, -90 * Math.PI / 180);

assert.deepEqual(createGltfStaticMeshBasisRotation(), {
  x: Math.PI / 2,
  y: 0,
  z: 0,
  order: "XYZ"
});

assert.equal(defaultImportedModelFaceReductionRatio, 0.85);

let modifiedCount = null;
let normalsRecomputed = false;
let weldedInput = null;
let sourceDisposed = false;
let workingGeometryDisposed = false;
const workingGeometry = {
  attributes: {
    position: {
      count: 100
    },
    normal: {
      count: 100
    },
    uv: {
      count: 100
    }
  },
  deleteAttribute(name) {
    delete this.attributes[name];
  },
  clearGroups() {},
  dispose() {
    workingGeometryDisposed = true;
  }
};
const sourceGeometry = {
  attributes: {
    position: {
      count: 100
    },
    normal: {
      count: 100
    },
    uv: {
      count: 100
    }
  },
  clone() {
    return workingGeometry;
  },
  computeVertexNormals() {
    normalsRecomputed = true;
  },
  dispose() {
    sourceDisposed = true;
  }
};
const weldedGeometry = {
  attributes: {
    position: {
      count: 100
    }
  },
  dispose() {}
};
const optimizedGeometry = {
  attributes: {
    position: {
      count: 15
    }
  },
  computeVertexNormals() {
    normalsRecomputed = true;
  }
};
const mesh = {
  isMesh: true,
  geometry: sourceGeometry,
  material: {
    disposed: false,
    dispose() {
      this.disposed = true;
    }
  },
  userData: {},
  castShadow: false,
  receiveShadow: false
};
const fakeObject = {
  traverse(callback) {
    callback(mesh);
  }
};
const fakeThree = {
  MeshStandardMaterial: class {
    constructor(options) {
      this.options = options;
    }
  }
};
const fakeSimplifier = {
  modify(geometry, count) {
    assert.equal(geometry, weldedGeometry);
    modifiedCount = count;
    return optimizedGeometry;
  }
};
function fakeMergeVertices(geometry) {
  weldedInput = geometry;
  return weldedGeometry;
}

optimizeImportedGrayModel(fakeObject, {
  THREE: fakeThree,
  simplifyModifier: fakeSimplifier,
  mergeVertices: fakeMergeVertices
});

assert.deepEqual(Object.keys(weldedInput.attributes), ["position"]);
assert.equal(modifiedCount, 85);
assert.equal(mesh.geometry, optimizedGeometry);
assert.equal(normalsRecomputed, true);
assert.equal(sourceDisposed, true);
assert.equal(workingGeometryDisposed, true);
assert.equal(mesh.material.options.color, 0x9b9b9b);
assert.equal(mesh.material.options.roughness, 0.92);
assert.notEqual(mesh.userData.pickable, false);
assert.equal(mesh.castShadow, true);
assert.equal(mesh.receiveShadow, true);

function makeTransformNode() {
  return {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    set(...values) {
      [this.x, this.y, this.z, this.w] = values;
    }
  };
}

function makeGroup() {
  return {
    children: [],
    name: "",
    parent: null,
    position: makeTransformNode(),
    quaternion: makeTransformNode(),
    rotation: makeTransformNode(),
    scale: makeTransformNode(),
    userData: {},
    add(child) {
      child.parent = this;
      this.children.push(child);
    },
    attach(child) {
      child.wasAttached = true;
      this.add(child);
    },
    remove(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      child.parent = null;
    },
    traverse(callback) {
      callback(this);
      this.children.forEach((child) => child.traverse?.(callback) ?? callback(child));
    }
  };
}

const syncedMesh = {
  isMesh: true,
  geometry: {
    attributes: {
      position: {
        count: 3
      }
    }
  },
  material: {
    dispose() {}
  },
  userData: {},
  castShadow: false,
  receiveShadow: false
};
const syncedChildMesh = {
  ...syncedMesh,
  userData: {}
};
const gltfTemplate = {
  clone() {
    const meshObject = makeGroup();
    meshObject.rotation = makeTransformNode();
    meshObject.traverse = (callback) => {
      callback(meshObject);
      callback(syncedChildMesh);
    };
    return meshObject;
  }
};
const fakeControllerThree = {
  Group: class {
    constructor() {
      return makeGroup();
    }
  },
  MeshStandardMaterial: fakeThree.MeshStandardMaterial
};
const fakeLoader = {
  load(_url, resolve) {
    resolve({ scene: gltfTemplate });
  }
};
const fakeScene = makeGroup();
const controller = createUnrealRockSyncController({
  THREE: fakeControllerThree,
  scene: fakeScene,
  loader: fakeLoader,
  semanticRulesUrl: "/ue-sync/semantic.rules.json",
  fetchJson: async (url) => {
    if (url.endsWith("semantic.rules.json")) {
      return semanticRules;
    }

    return {
      schema: "composition-pipeline.ue-scene.v2",
      assetsBaseUrl: "/ue-sync/meshes/",
      sceneOrigin: [0, 0, 0],
      gridSizeMeters: 5000,
      actors: [
        {
          id: "BP_Clickable",
          label: "BP Clickable",
          class: "BP_RuinWall",
          folderPath: "Ruins/Wall",
          tags: ["ruin"],
          transform: {
            location: [0, 0, 0],
            rotation: [0, 0, 90],
            quaternion: [0, 0, 0.7071068, 0.7071068],
            scale: [1, 1, 1]
          },
          components: [
            {
              id: "BP_Clickable_SM_1",
              name: "StaticMeshComponent0",
              type: "StaticMeshComponent",
              mesh: "Rock_Clickable.glb",
              meshAssetPath: "/Game/Ruins/Wall/Rock_Clickable",
              materialSlots: ["M_Stone"],
              tags: [],
              transform: {
                location: [10, 0, 0],
                rotation: [0, 0, 90],
                quaternion: [0, 0, 0.7071068, 0.7071068],
                scale: [1.1, 1.1, 1.9]
              }
            }
          ]
        }
      ]
    };
  }
});

await controller.sync();

const syncedRoot = controller.group.children[0];
assert.equal(syncedRoot.userData.assetRoot, syncedRoot);
assert.equal(syncedRoot.userData.assetType, "ue-scene-actor");
assert.notEqual(syncedRoot.userData.pickable, false);
assert.equal(syncedRoot.children.length, 1);
assert.equal(syncedRoot.scale.x, 1);
assert.equal(syncedRoot.scale.y, 1);
assert.equal(syncedRoot.scale.z, 1);
assertClose(syncedRoot.quaternion.z, -0.7071068);
assert.equal(syncedRoot.children[0].wasAttached, true);
assertClose(syncedRoot.children[0].scale.x, 0.011);
assertClose(syncedRoot.children[0].scale.y, 0.011);
assertClose(syncedRoot.children[0].scale.z, 0.019);
assert.equal(syncedRoot.children[0].children.length, 1);
assertClose(syncedRoot.children[0].children[0].rotation.x, Math.PI / 2);
assert.equal(syncedChildMesh.userData.assetRoot, syncedRoot);
assert.equal(syncedChildMesh.userData.assetType, "ue-scene-actor");
assert.notEqual(syncedChildMesh.userData.pickable, false);
assert.equal(controller.getDisplayMode(), "gray");
controller.setDisplayMode("semanticColor");
assert.equal(controller.getDisplayMode(), "semanticColor");
assert.equal(syncedChildMesh.material.options.color, "#d18b4b");
controller.setDisplayMode("gray");
assert.equal(syncedChildMesh.material.options.color, 0x9b9b9b);

let terrainLoaderCalled = false;
const terrainScene = makeGroup();
const terrainController = createUnrealRockSyncController({
  THREE: {
    ...fakeControllerThree,
    PlaneGeometry: class {
      constructor(width, depth, widthSegments, depthSegments) {
        this.width = width;
        this.depth = depth;
        this.widthSegments = widthSegments;
        this.depthSegments = depthSegments;
      }
    },
    Mesh: class {
      constructor(geometry, material) {
        this.isMesh = true;
        this.geometry = geometry;
        this.material = material;
        this.name = "";
        this.userData = {};
        this.castShadow = false;
        this.receiveShadow = false;
      }

      traverse(callback) {
        callback(this);
      }
    }
  },
  scene: terrainScene,
  loader: {
    load() {
      terrainLoaderCalled = true;
    }
  },
  semanticRulesUrl: "/ue-sync/semantic.rules.json",
  fetchJson: async (url) => {
    if (url.endsWith("semantic.rules.json")) {
      return {
        classes: {
          terrain: { id: 6, color: "#6f8f55" },
          unclassified: { id: 0, color: "#ff00ff" }
        },
        rules: []
      };
    }

    return {
      schema: "composition-pipeline.ue-scene.v2",
      sceneOrigin: [5000, 10000, 0],
      actors: [
        {
          id: "LandscapeVillage",
          label: "Landscape Village",
          class: "Landscape",
          semantic: "terrain",
          colorId: 6,
          transform: {
            location: [5000, 10000, 0],
            scale: [1, 1, 1]
          },
          components: [
            {
              id: "LandscapeStreamingProxy_0_0",
              name: "LandscapeStreamingProxy_0_0",
              type: "LandscapeStreamingProxy",
              semantic: "terrain",
              colorId: 6,
              transform: {
                location: [5100, 9800, 25],
                scale: [1, 1, 1]
              },
              terrain: {
                center: [5100, 9800, 25],
                extent: [200, 300, 50],
                size: [400, 600]
              }
            }
          ]
        }
      ]
    };
  }
});

await terrainController.sync();
const terrainRoot = terrainController.group.children[0];
const terrainComponent = terrainRoot.children[0];
const terrainMesh = terrainComponent.children[0];

assert.equal(terrainLoaderCalled, false);
assert.equal(terrainRoot.userData.semantic, "terrain");
assert.equal(terrainComponent.userData.type, "LandscapeStreamingProxy");
assert.equal(terrainMesh.geometry.width, 4);
assert.equal(terrainMesh.geometry.depth, 6);
assert.equal(terrainMesh.userData.ueSyncTerrain.size[0], 400);
assert.equal(terrainMesh.userData.semantic, "terrain");

const fallbackScene = makeGroup();
const fallbackController = createUnrealRockSyncController({
  THREE: fakeControllerThree,
  scene: fallbackScene,
  loader: fakeLoader,
  manifestUrl: "/ue-sync/scene.manifest.json",
  fallbackManifestUrl: "/ue-sync/rocks.instances.json",
  fetchJson: async (url) => {
    if (url.endsWith("scene.manifest.json") || url.endsWith("semantic.rules.json")) {
      throw new Error("missing");
    }

    return {
      instances: [
        {
          id: "Legacy_Rock",
          mesh: "Legacy_Rock.glb",
          location: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [100, 100, 100]
        }
      ]
    };
  }
});

const fallbackManifest = await fallbackController.sync();
assert.equal(fallbackManifest.instances.length, 1);
assert.equal(fallbackController.group.children.length, 1);
assert.equal(fallbackController.group.children[0].userData.assetType, "ue-rock");
