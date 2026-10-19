import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
  const canvas = document.getElementById('study-scene');
  const visual = document.querySelector('.auth-visual');
  if (!canvas || !visual) return;

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
    camera.position.set(0, 2.2, 14.2);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xf5f1ff, 0x1a2440, 2.05));
    const keyLight = new THREE.DirectionalLight(0xffe7c4, 3.2);
    keyLight.position.set(-3, 7, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x9887f3, 20, 12);
    rimLight.position.set(4, 3, -2);
    scene.add(rimLight);

    const objects = new THREE.Group();
    scene.add(objects);

    const material = (color, roughness = 0.48, metalness = 0.02) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const navy = material(0x273858);
    const purple = material(0x7769ce, 0.32);
    const paper = material(0xf4ebdc, 0.8);
    const ink = material(0x66728a, 0.72);
    const brass = material(0xd9a55f, 0.3, 0.55);
    const coral = material(0xd98168, 0.36);
    const mint = material(0x76b8a4, 0.32);

    const addBox = (width, height, depth, mat, position, group = objects, rotation = null) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const desk = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.18, 64), material(0x202e49, 0.82));
    desk.position.y = -0.42;
    desk.scale.set(1.16, 1, 0.72);
    desk.receiveShadow = true;
    objects.add(desk);

    const book = new THREE.Group();
    book.position.set(-0.25, -0.25, 0.2);
    book.scale.setScalar(0.84);
    book.rotation.y = -0.12;
    objects.add(book);
    addBox(4.7, 0.28, 2.85, purple, [0, 0, 0], book);
    addBox(4.42, 0.16, 2.62, paper, [0, 0.19, 0], book);
    addBox(2.12, 0.075, 2.58, paper, [-1.08, 0.31, 0], book);
    addBox(2.12, 0.075, 2.58, paper, [1.08, 0.31, 0], book);
    addBox(0.1, 0.16, 2.72, navy, [0, 0.2, 0], book);

    for (let line = 0; line < 5; line += 1) {
      const z = -0.8 + line * 0.32;
      addBox(1.25, 0.012, 0.018, ink, [-1.02, 0.354, z], book);
      addBox(1.25, 0.012, 0.018, ink, [1.02, 0.354, z], book);
    }
    addBox(0.62, 0.025, 0.09, coral, [-1.45, 0.36, -0.86], book);
    addBox(0.72, 0.025, 0.09, purple, [1.38, 0.36, -0.86], book);

    const clock = new THREE.Group();
    clock.position.set(2.1, 1.38, -0.45);
    clock.scale.setScalar(0.84);
    clock.rotation.x = Math.PI / 2;
    objects.add(clock);
    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.18, 48), brass);
    clockRim.castShadow = true;
    clock.add(clockRim);
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.2, 48), paper);
    clockFace.position.y = 0.13;
    clock.add(clockFace);
    addBox(0.045, 0.035, 0.44, navy, [0, 0.26, 0], clock, [0, 0, -0.28]);
    addBox(0.045, 0.035, 0.3, coral, [0.11, 0.26, 0.03], clock, [0, 0.83, 0]);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), brass);
    hub.position.set(0, 0.27, 0);
    clock.add(hub);

    const pencil = new THREE.Group();
    pencil.position.set(-1.9, 0.65, 1.1);
    pencil.scale.setScalar(0.82);
    pencil.rotation.z = -0.85;
    pencil.rotation.x = 0.12;
    objects.add(pencil);
    const pencilBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.45, 10), coral);
    pencilBody.castShadow = true;
    pencil.add(pencilBody);
    const pencilTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 10), paper);
    pencilTip.position.y = -1.34;
    pencilTip.castShadow = true;
    pencil.add(pencilTip);
    const pencilLead = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), navy);
    pencilLead.position.y = -1.51;
    pencil.add(pencilLead);
    const pencilEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.19, 10), brass);
    pencilEnd.position.y = 1.23;
    pencil.add(pencilEnd);

    const focusToken = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mint);
    focusToken.position.set(-1.85, 1.95, -0.8);
    focusToken.rotation.set(0.28, 0.42, 0.22);
    focusToken.castShadow = true;
    objects.add(focusToken);

    const taskCard = new THREE.Group();
    taskCard.position.set(1.75, 0.2, 1.2);
    taskCard.scale.setScalar(0.88);
    taskCard.rotation.set(-0.08, -0.14, -0.13);
    objects.add(taskCard);
    addBox(0.82, 0.13, 0.78, navy, [0, 0, 0], taskCard);
    addBox(0.62, 0.018, 0.58, paper, [0, 0.075, 0], taskCard);
    addBox(0.3, 0.025, 0.09, mint, [-0.1, 0.1, -0.04], taskCard);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let targetX = 0;
    let targetY = 0;
    let frame = 0;

    const resize = () => {
      const bounds = visual.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.position.z = bounds.width < 680 ? 12.5 : bounds.width < 980 ? 15.5 : 14.2;
      objects.position.y = bounds.width < 680 ? 1.4 : 0;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      if (visual.classList.contains('hidden') || visual.closest('.hidden')) return;
      if (!reducedMotion) {
        objects.rotation.y += 0.0015;
        focusToken.rotation.y += 0.004;
        focusToken.rotation.x += 0.0015;
        objects.rotation.x += (targetX - objects.rotation.x) * 0.025;
        objects.rotation.z += (targetY - objects.rotation.z) * 0.025;
      }
      renderer.render(scene, camera);
    };

    visual.addEventListener('pointermove', event => {
      if (reducedMotion) return;
      const bounds = visual.getBoundingClientRect();
      targetX = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.055;
      targetY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.055;
    });
    visual.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(visual);
    resize();
    visual.classList.add('scene-ready');
    animate();

    window.addEventListener('pagehide', () => {
      window.cancelAnimationFrame(frame);
      renderer.dispose();
    }, { once: true });
  } catch (error) {
    console.warn('The study scene could not be initialized.', error);
  }
})();