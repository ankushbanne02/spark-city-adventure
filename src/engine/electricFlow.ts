import * as THREE from 'three';

export interface GlowWireOptions {
  color?: number;
  emissiveIntensity?: number;
  radius?: number;
  segments?: number;
  glowing?: boolean;
}

export function addGlowWire(
  scene: THREE.Scene,
  pts: THREE.Vector3[],
  color: number,
  glowing = true,
  opts: GlowWireOptions = {},
): THREE.Mesh {
  const {
    emissiveIntensity = glowing ? 1.6 : 0.2,
    radius = 0.07,
    segments = 24,
  } = opts;

  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.3,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

export interface FlowParticleSystem {
  points: THREE.Points;
  update: (dt: number, active: boolean) => void;
  dispose: () => void;
}

export function createLinearFlow(
  scene: THREE.Scene,
  start: THREE.Vector3,
  end: THREE.Vector3,
  count = 60,
  color = 0xffd700,
  speed = 5,
): FlowParticleSystem {
  const positions = new Float32Array(count * 3);
  const dir = end.clone().sub(start);
  const len = dir.length();
  dir.normalize();

  const ts: number[] = [];
  for (let i = 0; i < count; i++) {
    ts.push(Math.random());
    const t = ts[i];
    const p = start.clone().addScaledVector(dir, t * len);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.25, transparent: true, opacity: 0 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  return {
    points: pts,
    update: (dt, active) => {
      mat.opacity = active ? 0.9 : 0;
      if (!active) return;
      const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < count; i++) {
        ts[i] = (ts[i] + (dt * speed) / len) % 1;
        const p = start.clone().addScaledVector(dir, ts[i] * len);
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose: () => {
      scene.remove(pts);
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createArcParticles(
  scene: THREE.Scene,
  center: THREE.Vector3,
  radius: number,
  count = 120,
  color = 0x00c2ff,
): FlowParticleSystem {
  const positions = new Float32Array(count * 3);
  const angles: number[] = Array.from({ length: count }, () => Math.random() * Math.PI * 2);
  const radii: number[] = Array.from({ length: count }, () => radius * (0.6 + Math.random() * 0.4));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 0 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  return {
    points: pts,
    update: (dt, active) => {
      mat.opacity = active ? 0.75 : 0;
      if (!active) return;
      const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < count; i++) {
        angles[i] = (angles[i] + dt * 2.5) % (Math.PI * 2);
        const r = radii[i];
        arr[i * 3] = center.x + Math.cos(angles[i]) * r;
        arr[i * 3 + 1] = center.y + Math.sin(angles[i]) * r * 0.5;
        arr[i * 3 + 2] = center.z + Math.sin(angles[i]) * r * 0.3;
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose: () => {
      scene.remove(pts);
      geo.dispose();
      mat.dispose();
    },
  };
}

export function pulseEmissive(
  mesh: THREE.Mesh,
  clock: THREE.Clock,
  baseIntensity: number,
  amplitude: number,
  freq: number,
) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = baseIntensity + Math.sin(clock.getElapsedTime() * freq) * amplitude;
}

export function createGlowingMaterial(color: number, emissiveIntensity = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.2,
    metalness: 0.8,
  });
}
