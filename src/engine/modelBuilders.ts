import * as THREE from 'three';

export interface BoxSpec {
  w: number; h: number; d: number;
  x: number; y: number; z: number;
  color?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function buildBox(scene: THREE.Scene, spec: BoxSpec): THREE.Mesh {
  const {
    w, h, d, x, y, z,
    color = 0xffffff,
    roughness = 0.7,
    metalness = 0,
    emissive,
    emissiveIntensity = 0,
    castShadow = true,
    receiveShadow = true,
  } = spec;

  const mat: THREE.MeshStandardMaterialParameters = { color, roughness, metalness };
  if (emissive !== undefined) {
    mat.emissive = new THREE.Color(emissive);
    mat.emissiveIntensity = emissiveIntensity;
  }

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial(mat),
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

export function buildCylinder(
  scene: THREE.Scene,
  rt: number, rb: number, h: number,
  x: number, y: number, z: number,
  color = 0xffffff,
  opts: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, 16),
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0,
      emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : undefined,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    }),
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildUtilityPole(
  scene: THREE.Scene,
  x: number, z: number,
  height = 13,
): THREE.Group {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, height, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 }),
  );
  pole.position.y = height / 2;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20 }),
  );
  arm.position.y = height - 1.5;
  group.add(arm);

  [-0.9, 0.9].forEach(dx => {
    const ins = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0xaaaacc }),
    );
    ins.position.set(dx, height - 1.7, 0);
    group.add(ins);
  });

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

export function buildMCBPanel(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  breakerCount = 6,
): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 4.5, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3 }),
  );
  group.add(body);

  const colors = [0x22c55e, 0x22c55e, 0xf59e0b, 0xf59e0b, 0x3b82f6, 0x3b82f6];
  for (let i = 0; i < breakerCount; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.1, 0.5),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.4,
      }),
    );
    m.position.set(-1.1 + i * 0.45, 0.1, 0.55);
    group.add(m);
  }

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 0.32, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.4 }),
  );
  label.position.set(0, 1.9, 0.5);
  group.add(label);

  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

export function buildFloor(
  scene: THREE.Scene,
  w: number, d: number,
  color = 0x6ab04c,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.05;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildHouseWalls(
  scene: THREE.Scene,
  floorW = 18, floorD = 14, wallH = 5,
  wallColor = 0xf5f0ea,
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });

  const specs = [
    { w: floorW, h: wallH, d: 0.3, x: 0, z: -(floorD / 2) },
    { w: floorW, h: wallH, d: 0.3, x: 0, z: floorD / 2 },
    { w: 0.3, h: wallH, d: floorD, x: -(floorW / 2), z: 0 },
    { w: 0.3, h: wallH, d: floorD, x: floorW / 2, z: 0 },
  ];

  specs.forEach(({ w, h, d, x, z }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    group.add(m);
  });

  scene.add(group);
  return group;
}
