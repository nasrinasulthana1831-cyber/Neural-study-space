import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const canvas = document.getElementById('learning-universe');
  if (!canvas) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: window.devicePixelRatio <= 1.5,
      powerPreference: 'low-power'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0, 12);

    const ambient = new THREE.AmbientLight(0x9aa9ff, 0.9);
    scene.add(ambient);
    const violetLight = new THREE.PointLight(0x9274ff, 16, 16);
    violetLight.position.set(3, 2.5, 4);
    scene.add(violetLight);
    const cyanLight = new THREE.PointLight(0x38dbe4, 12, 13);
    cyanLight.position.set(-3, -2, 3);
    scene.add(cyanLight);

    const field = new THREE.Group();
    field.position.set(2.55, 0.05, 0);
    scene.add(field);

    const neuralCore = new THREE.Group();
    field.add(neuralCore);
    const hemispheres = [];
    const networkMaterials = [];
    const nodeInstances = [];

    function makeHemisphere(side, color) {
      const lobe = new THREE.Group();
      lobe.position.x = side * 0.36;
      lobe.rotation.z = side * -0.055;
      neuralCore.add(lobe);

      const shellGeometry = new THREE.SphereGeometry(0.84, 40, 32);
      const positions = shellGeometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const ripple = 1 + Math.sin(y * 17 + z * 9) * 0.018 + Math.sin(x * 11 - y * 7) * 0.012;
        positions.setXYZ(index, x * ripple, y * ripple * 1.13, z * ripple * 0.79);
      }
      shellGeometry.computeVertexNormals();

      const shell = new THREE.Mesh(
        shellGeometry,
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.12,
          depthWrite: false
        })
      );
      lobe.add(shell);
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.82, 28, 20),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.028, side: THREE.BackSide })
      );
      inner.scale.set(1, 1.12, 0.78);
      lobe.add(inner);

      const random = (() => {
        let seed = side > 0 ? 4781 : 8263;
        return () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
      })();
      const nodeCount = 76;
      const nodePositions = [];
      for (let index = 0; index < nodeCount; index += 1) {
        const y = random() * 1.85 - 0.925;
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const wave = Math.sin(y * 13 + Math.cos(angle * 3)) * 0.035;
        nodePositions.push(new THREE.Vector3(
          (Math.cos(angle) * radius + wave) * 0.82,
          y * 0.93,
          Math.sin(angle) * radius * 0.63
        ));
      }

      const edges = [];
      nodePositions.forEach((point, pointIndex) => {
        const nearest = nodePositions
          .map((other, otherIndex) => ({ other, otherIndex, distance: point.distanceTo(other) }))
          .filter(item => item.otherIndex !== pointIndex)
          .sort((first, second) => first.distance - second.distance)
          .slice(0, 3);
        nearest.forEach(item => {
          if (item.otherIndex > pointIndex && item.distance < 0.57) {
            edges.push(point.x, point.y, point.z, item.other.x, item.other.y, item.other.z);
          }
        });
      });
      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
      const edgeMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      networkMaterials.push(edgeMaterial);
      lobe.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

      const nodeMesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.022, 8, 6),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        }),
        nodeCount
      );
      const dummy = new THREE.Object3D();
      nodePositions.forEach((point, index) => {
        dummy.position.copy(point);
        dummy.scale.setScalar(index % 7 === 0 ? 1.5 : 1);
        dummy.updateMatrix();
        nodeMesh.setMatrixAt(index, dummy.matrix);
      });
      nodeMesh.instanceMatrix.needsUpdate = true;
      nodeMesh.userData.baseColor = color;
      nodeInstances.push(nodeMesh);
      lobe.add(nodeMesh);

      hemispheres.push(lobe);
    }

    makeHemisphere(-1, 0x51dce1);
    makeHemisphere(1, 0xa48aff);

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.012, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf2a5ff,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending
      })
    );
    seam.position.set(0, 0, 0.66);
    neuralCore.add(seam);

    const orbitMaterials = [];
    const orbits = [
      { radius: 1.25, tube: 0.006, color: 0x5adce8, rotation: [0.94, 0.18, 0.22], opacity: 0.48 },
      { radius: 1.53, tube: 0.004, color: 0x9b7bff, rotation: [0.22, 1.13, -0.24], opacity: 0.32 },
      { radius: 1.83, tube: 0.004, color: 0xf080d5, rotation: [1.17, 0.36, 0.6], opacity: 0.22 }
    ];
    orbits.forEach((config, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(config.radius, config.tube, 8, 180),
        material
      );
      ring.rotation.set(...config.rotation);
      ring.userData.orbitIndex = index;
      field.add(ring);
      orbitMaterials.push(material);
    });

    function makeGlyph(label, color) {
      const textureCanvas = document.createElement('canvas');
      textureCanvas.width = 256;
      textureCanvas.height = 128;
      const context = textureCanvas.getContext('2d');
      context.clearRect(0, 0, 256, 128);
      context.font = '600 66px "Outfit", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = color;
      context.shadowBlur = 24;
      context.fillStyle = color;
      context.fillText(label, 128, 64);
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      sprite.scale.set(0.7, 0.35, 1);
      return sprite;
    }

    const glyphs = [
      { text: '∑', color: '#82e8f1', position: [-1.7, 1.14, 0.25] },
      { text: 'π', color: '#c7a4ff', position: [1.7, -0.78, 0.35] },
      { text: 'f(x)', color: '#f19bdd', position: [0.15, 1.85, -0.35] },
      { text: '∞', color: '#79dbc1', position: [-1.55, -1.25, -0.15] }
    ];
    glyphs.forEach((glyph, index) => {
      const sprite = makeGlyph(glyph.text, glyph.color);
      sprite.position.set(...glyph.position);
      sprite.userData.floatOffset = index * 1.7;
      sprite.userData.baseY = glyph.position[1];
      field.add(sprite);
    });

    const studyObject = new THREE.Group();
    studyObject.position.set(1.6, 0.32, 0.4);
    studyObject.rotation.set(0.28, -0.54, 0.16);
    field.add(studyObject);
    const bookBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.1, 0.43),
      new THREE.MeshBasicMaterial({ color: 0x705ac8, transparent: true, opacity: 0.68 })
    );
    studyObject.add(bookBase);
    [-0.145, 0.145].forEach(side => {
      const page = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.035, 0.39),
        new THREE.MeshBasicMaterial({ color: side < 0 ? 0x81dee7 : 0xc3b1ff, transparent: true, opacity: 0.75 })
      );
      page.position.set(side, 0.068, -0.005);
      studyObject.add(page);
    });
    const bookSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.045, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xf1a5e6, transparent: true, opacity: 0.82 })
    );
    bookSpine.position.set(0, 0.078, 0);
    studyObject.add(bookSpine);

    const particleCount = window.innerWidth < 700 ? 240 : 430;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleDrifts = new Float32Array(particleCount);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 19;
      particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 12;
      particlePositions[index * 3 + 2] = -1 - Math.random() * 12;
      particleDrifts[index] = 0.05 + Math.random() * 0.12;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x93c9f4,
      size: 0.018,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const pulseRings = [];
    for (let index = 0; index < 3; index += 1) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0x53e0e6 : 0x9b7bff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const pulseRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.28 + index * 0.12, 0.009, 6, 128),
        ringMaterial
      );
      pulseRing.rotation.set(0.4 + index * 0.27, index * 0.63, 0.5);
      pulseRing.userData.delay = index * 0.24;
      field.add(pulseRing);
      pulseRings.push(pulseRing);
    }

    let pulseStart = -10;
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    const clock = new THREE.Clock();

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const appIsActive = !document.getElementById('app-screen')?.classList.contains('hidden');
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 700 ? 14 : 12;
      camera.updateProjectionMatrix();
      field.position.x = appIsActive
        ? (width < 700 ? 1.3 : width < 1100 ? 2 : 2.55)
        : (width < 700 ? 0.55 : -2.45);
      field.scale.setScalar(width < 700 ? 0.82 : 1);
      if (reducedMotion) renderer.render(scene, camera);
    }

    function pulse() {
      if (reducedMotion) return;
      pulseStart = clock.elapsedTime;
    }

    function animate() {
      if (document.hidden) {
        frame = 0;
        return;
      }
      if (reducedMotion) return;
      frame = window.requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.04);
      const elapsed = clock.elapsedTime;
      neuralCore.rotation.y += 0.0018;
      neuralCore.rotation.x += (pointerY * 0.11 - neuralCore.rotation.x) * 0.012;
      neuralCore.rotation.z += (pointerX * 0.12 - neuralCore.rotation.z) * 0.012;
      hemispheres[0].rotation.y = -0.06 + Math.sin(elapsed * 0.26) * 0.018;
      hemispheres[1].rotation.y = 0.06 + Math.sin(elapsed * 0.26 + 0.3) * 0.018;
      studyObject.position.y = 0.32 + Math.sin(elapsed * 0.45) * 0.07;
      studyObject.rotation.y += 0.0012;
      field.rotation.y += (pointerX * 0.028 - field.rotation.y) * 0.008;
      field.rotation.x += (-pointerY * 0.02 - field.rotation.x) * 0.008;
      field.children.forEach(child => {
        if (child.isSprite) {
          child.position.y = child.userData.baseY + Math.sin(elapsed * 0.45 + child.userData.floatOffset) * 0.08;
        } else if (child.userData.orbitIndex !== undefined) {
          child.rotation.z += 0.00028 * (child.userData.orbitIndex + 1);
        }
      });
      const positions = particleGeometry.attributes.position.array;
      for (let index = 0; index < particleCount; index += 1) {
        const yOffset = index * 3 + 1;
        positions[yOffset] += particleDrifts[index] * delta;
        if (positions[yOffset] > 6) positions[yOffset] = -6;
      }
      particleGeometry.attributes.position.needsUpdate = true;

      const pulseProgress = elapsed - pulseStart;
      pulseRings.forEach(ring => {
        const progress = (pulseProgress - ring.userData.delay) / 1.7;
        if (progress >= 0 && progress <= 1) {
          ring.scale.setScalar(0.58 + progress * 0.8);
          ring.material.opacity = Math.sin(progress * Math.PI) * 0.42;
        } else {
          ring.material.opacity = 0;
        }
      });

      renderer.render(scene, camera);
    }

    window.addEventListener('pointermove', event => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('study-space-pulse', pulse);
    const appObserver = new MutationObserver(resize);
    appObserver.observe(document.getElementById('app-screen'), { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (reducedMotion) renderer.render(scene, camera);
      else if (!frame) animate();
    });
    window.addEventListener('pagehide', () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('study-space-pulse', pulse);
      appObserver.disconnect();
      renderer.dispose();
      scene.traverse(object => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
    }, { once: true });

    resize();
    if (reducedMotion) renderer.render(scene, camera);
    else animate();
    document.documentElement.classList.add('learning-universe-ready');
  } catch (error) {
    console.warn('The learning universe could not be initialized.', error);
    renderer?.dispose();
    document.documentElement.classList.add('learning-universe-fallback');
  }
})();
