import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneOptions {
  background?: number;
  fogDensity?: number;
  cameraPosition?: [number, number, number];
  fov?: number;
  shadows?: boolean;
  showGrid?: boolean;
  gridSize?: number;
}

export interface SceneResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  cleanup: () => void;
  animationId: { current: number };
}

const DEFAULTS: Required<SceneOptions> = {
  background: 0xf8fafc,
  fogDensity: 0.015,
  cameraPosition: [0, 15, 25],
  fov: 60,
  shadows: true,
  showGrid: true,
  gridSize: 50,
};

export function initScene(container: HTMLDivElement, opts: SceneOptions = {}): SceneResult {
  const o = { ...DEFAULTS, ...opts };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background);
  if (o.fogDensity > 0) {
    scene.fog = new THREE.FogExp2(o.background, o.fogDensity);
  }

  const camera = new THREE.PerspectiveCamera(
    o.fov,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(...o.cameraPosition);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = o.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 80;

  setupLighting(scene);

  if (o.showGrid) {
    const grid = new THREE.GridHelper(o.gridSize, o.gridSize, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = -0.1;
    scene.add(grid);
  }

  const animationId = { current: 0 };

  const handleResize = () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', handleResize);

  return {
    scene,
    camera,
    renderer,
    controls,
    animationId,
    cleanup: () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

function setupLighting(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.35);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
  fill.position.set(-20, 10, -20);
  scene.add(fill);
}

export function startRenderLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  animationId: { current: number },
  onFrame?: (dt: number) => void,
) {
  let last = performance.now();

  const loop = () => {
    animationId.current = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    controls.update();
    if (onFrame) onFrame(dt);
    renderer.render(scene, camera);
  };
  loop();
}

export { initScene as initBasicScene };
