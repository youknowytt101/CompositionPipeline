import * as THREE from "three";

export function createSelectionOutline(renderer, camera) {
  const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false
  });
  const maskScene = new THREE.Scene();
  const maskMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });
  const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texelSize = new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight);
  const previousClearColor = new THREE.Color();
  const maskMeshes = [];
  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      maskTexture: { value: target.texture },
      texelSize: { value: texelSize },
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
  const compositeScene = new THREE.Scene();

  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));

  function rebuild(selectedAsset, visible) {
    maskScene.clear();
    maskMeshes.length = 0;

    if (!selectedAsset || !visible) {
      return;
    }

    selectedAsset.traverse((child) => {
      if (!child.isMesh || child.userData.pickable === false) {
        return;
      }

      const maskMesh = new THREE.Mesh(child.geometry, maskMaterial);

      maskMesh.frustumCulled = false;
      maskMesh.userData.source = child;
      maskScene.add(maskMesh);
      maskMeshes.push(maskMesh);
    });
  }

  function sync() {
    for (const maskMesh of maskMeshes) {
      const source = maskMesh.userData.source;

      source.updateWorldMatrix(true, false);
      source.matrixWorld.decompose(maskMesh.position, maskMesh.quaternion, maskMesh.scale);
      maskMesh.visible = source.visible;
    }
  }

  function render(selectedAsset, visible) {
    if (!selectedAsset || !visible || maskMeshes.length === 0) {
      return;
    }

    sync();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(maskScene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.clearDepth();
    const previousAutoClear = renderer.autoClear;

    renderer.autoClear = false;
    renderer.render(compositeScene, compositeCamera);
    renderer.autoClear = previousAutoClear;
  }

  function resize(width, height) {
    target.setSize(width, height);
    texelSize.set(1 / width, 1 / height);
  }

  return {
    rebuild,
    render,
    resize
  };
}

