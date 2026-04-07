import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { initBasicScene } from '../../utils/three-helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

type ComponentId = 'meter' | 'switch' | 'mcb';
type NodeId = 'pole' | 'meter' | 'switch' | 'mcb' | 'house';
type WireType = 'phase' | 'neutral' | 'earth';

const WIRE_META: Record<WireType, { color: string; three: number; name: string; label: string }> = {
  phase:   { color: '#ef4444', three: 0xef4444, name: 'Phase',   label: 'Live 240V ⚠ Never touch!' },
  neutral: { color: '#3b82f6', three: 0x3b82f6, name: 'Neutral', label: 'Return path to grid'       },
  earth:   { color: '#22c55e', three: 0x22c55e, name: 'Earth',   label: 'Safety ground wire'        },
};

// Valid connection pairs (from → to, must be adjacent)
const ADJACENT: [NodeId, NodeId][] = [
  ['pole', 'meter'],
  ['meter', 'switch'],
  ['switch', 'mcb'],
  ['mcb', 'house'],
];

// Segments user must wire (pole→meter is pre-wired by utility)
const USER_SEGMENTS: [NodeId, NodeId][] = [
  ['meter', 'switch'],
  ['switch', 'mcb'],
  ['mcb', 'house'],
];

const NODE_ICONS: Record<NodeId, string> = {
  pole: '🗼',
  meter: '📊',
  switch: '🔴',
  mcb: '🛡️',
  house: '🏠',
};

const NODE_LABELS: Record<NodeId, string> = {
  pole:   'Utility Pole',
  meter:  'Electric Meter',
  switch: 'Main Switch',
  mcb:    'MCB Panel',
  house:  'House Circuit',
};

const COMPONENT_INFO: Record<ComponentId, { title: string; icon: string; tip: string }> = {
  meter:  { icon: '📊', title: 'Electric Meter',    tip: '⚡ Counts every kWh! 1 kWh = 1000W running for 1 hour.' },
  switch: { icon: '🔴', title: 'Main Switch',        tip: '🔴 ALWAYS turn this OFF before any electrical work!' },
  mcb:    { icon: '🛡️', title: 'MCB Panel',         tip: '🛡️ Breakers trip in 0.01s — faster than a heartbeat!' },
};

const WIRE_TIPS: Record<string, string> = {
  'phase_meter_switch':   '⚠️ Phase wire carries live 240V — handle with extreme care!',
  'phase_switch_mcb':     '⚡ Phase enters the MCB panel and splits to each room circuit.',
  'phase_mcb_house':      '💡 Phase wire powers every socket and light in the house.',
  'neutral_meter_switch': '↩️ Neutral returns current safely back to the grid.',
  'neutral_switch_mcb':   '🔵 Neutral completes the circuit in every appliance.',
  'neutral_mcb_house':    '✅ Both Phase + Neutral = a working 240V circuit!',
  'earth_meter_switch':   '🟢 Earth wire protects against electric shock faults.',
  'earth_switch_mcb':     '🌍 Earth diverts fault current safely to the ground.',
  'earth_mcb_house':      '🛡️ All 3 wires connected — the house is safely wired!',
};

// ─────────────────────────────────────────────────────────────
// Wire path control points (in Three.js world space)
// ─────────────────────────────────────────────────────────────

const Y_OFFSETS: Record<WireType, number> = { phase: 0.13, neutral: 0, earth: -0.13 };

function getWirePath(from: NodeId, to: NodeId, wire: WireType): THREE.Vector3[] {
  const yo = Y_OFFSETS[wire];
  const paths: Record<string, THREE.Vector3[]> = {
    'pole_meter': [
      new THREE.Vector3(-14, 8.5 + yo, 2),
      new THREE.Vector3(-11.5, 9 + yo, -1),
      new THREE.Vector3(-9.5, 6 + yo, -2),
      new THREE.Vector3(-9.2, 4 + yo, -2),
    ],
    'meter_switch': [
      new THREE.Vector3(-9.2, 3.5 + yo, -2),
      new THREE.Vector3(-9, 4.2 + yo, -3.5),
      new THREE.Vector3(-8.9, 3.8 + yo, -4.8),
      new THREE.Vector3(-8.8, 3.5 + yo, -5),
    ],
    'switch_mcb': [
      new THREE.Vector3(-8.8, 3.5 + yo, -5),
      new THREE.Vector3(-8.8, 4 + yo, -5.9),
      new THREE.Vector3(-8.8, 3.5 + yo, -6.8),
    ],
    'mcb_house': [
      new THREE.Vector3(-8.8, 5 + yo, -6.8),
      new THREE.Vector3(-6, 5.5 + yo, -6.5),
      new THREE.Vector3(0, 5.5 + yo, -5),
      new THREE.Vector3(0, 5 + yo, 0),
    ],
  };
  return paths[`${from}_${to}`] ?? [];
}

// ─────────────────────────────────────────────────────────────
// 3-D scene builder
// ─────────────────────────────────────────────────────────────

function addTube(scene: THREE.Scene, pts: THREE.Vector3[], color: number, r = 0.07): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 24, r, 7, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

function buildHouseScene(scene: THREE.Scene, refs: Record<string, THREE.Object3D | null>) {
  // ── Ground ──
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 50),
    new THREE.MeshStandardMaterial({ color: 0x8fca6a, roughness: 0.9 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.05;
  scene.add(grass);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.25, 14),
    new THREE.MeshStandardMaterial({ color: 0xede5d8, roughness: 0.85 }),
  );
  floor.position.set(0, 0.12, 0);
  scene.add(floor);

  // ── Walls ──
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number, color = 0xf8f5f0, opacity = 1) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      transparent: opacity < 1,
      opacity,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  };

  wall(18, 5, 0.3, 0, 2.5, -7);           // back
  wall(0.3, 5, 14, -9, 2.5, 0);           // left (solid — interior)
  wall(0.3, 5, 14, 9, 2.5, 0);            // right
  // Front wall — semi-transparent so interior is visible
  wall(18, 5, 0.3, 0, 2.5, 7, 0xf0f4ff, 0.25);
  // Interior dividers
  wall(7, 5, 0.3, -5, 2.5, 0, 0xedeae6);
  wall(7, 5, 0.3, 5, 2.5, 0, 0xedeae6);

  // ── Room floor tints ──
  const roomFloor = (color: number, x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.26, z);
    scene.add(m);
  };
  roomFloor(0xe8dfd0, -4, 0, 8, 12);
  roomFloor(0xe0e8e0, 0, -3.5, 8, 7);
  roomFloor(0xe8e0f0, 5, 0, 8, 14);

  // ── MCB Panel (pre-placed, always visible) ──
  const mcbPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.2 }),
  );
  mcbPanel.position.set(-8.8, 3.5, -6.8);
  scene.add(mcbPanel);
  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.6, 0.35),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x22c55e : 0xf59e0b,
        emissive: i % 2 === 0 ? 0x22c55e : 0xf59e0b,
        emissiveIntensity: 0.3,
      }),
    );
    br.position.set(-9.2 + i * 0.4, 3.5, -6.5);
    scene.add(br);
  }
  // MCB label bar
  const mcbLbl = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.3, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  mcbLbl.position.set(-7.85, 4.7, -6.8);
  scene.add(mcbLbl);

  // ── Utility Pole (outside left) ──
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.26, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 }),
  );
  pole.position.set(-14, 7, 2);
  scene.add(pole);
  const poleArm = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x6a4a30 }),
  );
  poleArm.position.set(-14, 13, 2);
  scene.add(poleArm);
  [-0.7, 0.7].forEach(dx => {
    const ins = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.36, 8),
      new THREE.MeshStandardMaterial({ color: 0x8888bb }),
    );
    ins.position.set(-14 + dx, 12.8, 2);
    scene.add(ins);
  });
  // Service cable (pole to meter area, dim initially)
  const serviceCable = addTube(scene, [
    new THREE.Vector3(-14, 13, 2),
    new THREE.Vector3(-11.5, 9, -1),
    new THREE.Vector3(-9.5, 6, -2),
    new THREE.Vector3(-9.2, 4, -2),
  ], 0x444444, 0.05);
  serviceCable.visible = true;
  (serviceCable.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  refs['serviceCable'] = serviceCable;

  // ── Electric Meter (hidden until placed) ──
  const meterGroup = new THREE.Group();
  const meterPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 3.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.4 }),
  );
  const meterCasing = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.8, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }),
  );
  meterCasing.position.x = 0.18;
  const meterLcd = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.55, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xc8f0d0, roughness: 0.2 }),
  );
  meterLcd.position.set(0.32, 0.3, 0);
  const meterDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xfafafa }),
  );
  meterDial.rotation.z = Math.PI / 2;
  meterDial.position.set(0.32, -0.55, 0);
  const meterStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.28, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  meterStrip.position.set(0.32, -1.1, 0);
  meterGroup.add(meterPlate, meterCasing, meterLcd, meterDial, meterStrip);
  meterGroup.position.set(-9.1, 3.5, -2);
  meterGroup.visible = false;
  scene.add(meterGroup);
  refs['meter3d'] = meterGroup;

  // ── Main Switch (hidden until placed) ──
  const switchGroup = new THREE.Group();
  const swBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 1.9, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xbb2020, roughness: 0.5 }),
  );
  const swLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.9, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  swLever.position.set(0.2, 0.38, 0);
  const swLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x22dd44, emissive: 0x22dd44, emissiveIntensity: 0.8 }),
  );
  swLed.position.set(0.2, -0.45, 0);
  switchGroup.add(swBody, swLever, swLed);
  switchGroup.position.set(-8.75, 3.5, -5);
  switchGroup.visible = false;
  scene.add(switchGroup);
  refs['switch3d'] = switchGroup;

  // ── Hall furniture ──
  const couch = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.8, 2),
    new THREE.MeshStandardMaterial({ color: 0x9b6a4a }),
  );
  couch.position.set(-4, 0.65, 4);
  scene.add(couch);
  const couchBack = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.6, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x8a5a3a }),
  );
  couchBack.position.set(-4, 1.25, 4.9);
  scene.add(couchBack);

  // Hall TV
  const hallTvFrame = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.5, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
  );
  const hallTvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.1, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  hallTvScreen.position.z = 0.02;
  const hallTvGrp = new THREE.Group();
  hallTvGrp.add(hallTvFrame, hallTvScreen);
  hallTvGrp.position.set(-4, 2.5, -6.8);
  scene.add(hallTvGrp);
  refs['tvScreen_hall'] = hallTvScreen;

  // Hall bulb
  const hallBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xccccaa }),
  );
  hallBulb.position.set(-4, 4.7, 1);
  scene.add(hallBulb);
  refs['bulb_hall'] = hallBulb;

  // Hall ceiling light
  const hallCeilLight = new THREE.PointLight(0xffeebb, 0, 14);
  hallCeilLight.position.set(-4, 4.7, 1);
  scene.add(hallCeilLight);
  refs['ceilLight_hall'] = hallCeilLight;

  // Hall fan
  const hallFan = new THREE.Group();
  const hallFanHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x888877 }),
  );
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.07, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xb09878 }),
    );
    blade.position.x = 1.3;
    const piv = new THREE.Group();
    piv.rotation.y = (Math.PI / 2) * i;
    piv.add(blade);
    hallFan.add(piv);
  }
  hallFan.add(hallFanHub);
  hallFan.position.set(-4, 4.65, 3);
  scene.add(hallFan);
  refs['fan_hall'] = hallFan;

  // ── Bedroom ──
  const bedBase = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.5, 5),
    new THREE.MeshStandardMaterial({ color: 0xd4c4a8 }),
  );
  bedBase.position.set(5, 0.5, 2);
  scene.add(bedBase);
  const bedHead = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xb8a080 }),
  );
  bedHead.position.set(5, 1.1, -0.2);
  scene.add(bedHead);

  const bedTvFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 2.2, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
  );
  const bedTvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 1.8, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  bedTvScreen.position.z = 0.02;
  const bedTvGrp = new THREE.Group();
  bedTvGrp.add(bedTvFrame, bedTvScreen);
  bedTvGrp.position.set(5, 2.4, -6.8);
  scene.add(bedTvGrp);
  refs['tvScreen_bed'] = bedTvScreen;

  const bedBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xccccaa }),
  );
  bedBulb.position.set(5, 4.7, 2.5);
  scene.add(bedBulb);
  refs['bulb_bed'] = bedBulb;

  const bedCeilLight = new THREE.PointLight(0xffeebb, 0, 14);
  bedCeilLight.position.set(5, 4.7, 2.5);
  scene.add(bedCeilLight);
  refs['ceilLight_bed'] = bedCeilLight;

  const bedFan = new THREE.Group();
  const bedFanHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x888877 }),
  );
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.07, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xb09878 }),
    );
    blade.position.x = 1.2;
    const piv = new THREE.Group();
    piv.rotation.y = (Math.PI / 2) * i;
    piv.add(blade);
    bedFan.add(piv);
  }
  bedFan.add(bedFanHub);
  bedFan.position.set(5, 4.65, 3.5);
  scene.add(bedFan);
  refs['fan_bed'] = bedFan;

  // ── Kitchen ──
  const fridgeBody = new THREE.Mesh(
    new THREE.BoxGeometry(2, 4.5, 2),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.3 }),
  );
  fridgeBody.position.set(0.5, 2.25, -5.5);
  scene.add(fridgeBody);
  const kitBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xccccaa }),
  );
  kitBulb.position.set(0, 4.7, -3.5);
  scene.add(kitBulb);
  refs['bulb_kit'] = kitBulb;

  const kitCeilLight = new THREE.PointLight(0xffeebb, 0, 12);
  kitCeilLight.position.set(0, 4.7, -3.5);
  scene.add(kitCeilLight);
  refs['ceilLight_kit'] = kitCeilLight;

  const washerBody = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2.2, 2),
    new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }),
  );
  washerBody.position.set(-2.5, 1.1, -5.5);
  scene.add(washerBody);
  const washerDoor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.14, 20),
    new THREE.MeshStandardMaterial({ color: 0xaaaacc, metalness: 0.4 }),
  );
  washerDoor.rotation.x = Math.PI / 2;
  washerDoor.position.set(-2.5, 1.2, -4.45);
  scene.add(washerDoor);
}

// ─────────────────────────────────────────────────────────────
// Spark particle effect
// ─────────────────────────────────────────────────────────────

function createSpark(scene: THREE.Scene, pos: THREE.Vector3): () => void {
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2 }),
    );
    m.position.copy(pos);
    scene.add(m);
    sparks.push(m);
  }
  const velocities = sparks.map(() => new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    Math.random() * 3 + 1,
    (Math.random() - 0.5) * 3,
  ));
  let t = 0;
  const interval = setInterval(() => {
    t += 0.05;
    sparks.forEach((s, i) => {
      s.position.addScaledVector(velocities[i], 0.05);
      velocities[i].y -= 0.1;
      s.scale.setScalar(Math.max(0, 1 - t * 1.5));
    });
    if (t > 0.8) {
      clearInterval(interval);
      sparks.forEach(s => scene.remove(s));
    }
  }, 30);
  return () => { clearInterval(interval); sparks.forEach(s => scene.remove(s)); };
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export const Level6Wiring = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const sceneRef = useRef<THREE.Scene | null>(null);
  const refs3d = useRef<Record<string, THREE.Object3D | null>>({});
  const wireMeshes = useRef<Record<string, THREE.Mesh>>({});
  const fanRef = useRef<{ hall: THREE.Object3D | null; bed: THREE.Object3D | null }>({ hall: null, bed: null });
  const completedRef = useRef(false);

  const [placedComponents, setPlacedComponents] = useState<Set<ComponentId>>(new Set());
  const [selectedWire, setSelectedWire] = useState<WireType | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<NodeId | null>(null);
  const [connections, setConnections] = useState<Set<string>>(new Set()); // "{wire}_{from}_{to}"
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [circuitComplete, setCircuitComplete] = useState(false);
  const [phase, setPhase] = useState<'place' | 'wire' | 'done'>('place');

  // ── Derived state ──
  const allComponentsPlaced = placedComponents.has('meter') && placedComponents.has('switch') && placedComponents.has('mcb');
  const totalRequired = USER_SEGMENTS.length * 3; // 3 wire types × 3 segments = 9
  const connectedCount = connections.size;
  const progress = Math.round((connectedCount / totalRequired) * 100);

  // Count complete wire types
  const wireComplete = (wire: WireType) =>
    USER_SEGMENTS.every(([f, t]) => connections.has(`${wire}_${f}_${t}`));
  const allWiresComplete = (['phase', 'neutral', 'earth'] as WireType[]).every(wireComplete);

  // ── Init 3D scene ──
  useEffect(() => {
    if (!containerRef.current) return;
    const { scene, camera, renderer, controls, cleanup } = initBasicScene(containerRef.current);
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf0f4f8);
    camera.position.set(18, 20, 18);
    controls.target.set(0, 2, 0);
    controls.maxPolarAngle = Math.PI / 2.2;

    buildHouseScene(scene, refs3d.current);
    fanRef.current.hall = refs3d.current['fan_hall'];
    fanRef.current.bed = refs3d.current['fan_bed'];

    setVoltMessage('🏠 Home Wiring! Place the electrical components, then connect the wires to power the house!');

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (fanRef.current.hall) (fanRef.current.hall as THREE.Group).rotation.y += 0;
      if (fanRef.current.bed) (fanRef.current.bed as THREE.Group).rotation.y += 0;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); cleanup(); sceneRef.current = null; };
  }, []);

  // ── Enable fans when circuit is complete ──
  useEffect(() => {
    if (!circuitComplete) return;
    let frameId: number;
    const spin = () => {
      frameId = requestAnimationFrame(spin);
      if (fanRef.current.hall) (fanRef.current.hall as THREE.Group).rotation.y += 0.05;
      if (fanRef.current.bed) (fanRef.current.bed as THREE.Group).rotation.y += 0.04;
    };
    spin();
    return () => cancelAnimationFrame(frameId);
  }, [circuitComplete]);

  // ── Show feedback toast ──
  const showFeedback = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3200);
  }, []);

  // ── Place a component ──
  const placeComponent = useCallback((id: ComponentId) => {
    if (placedComponents.has(id)) return;
    const obj = refs3d.current[`${id}3d`];
    if (obj) obj.visible = true;
    setPlacedComponents(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    addScore(20);
    const info = COMPONENT_INFO[id];
    showFeedback(`✅ ${info.title} placed! ${info.tip}`, 'success');
    setVoltMessage(`✅ ${info.title} installed! ${info.tip}`);
  }, [placedComponents, addScore, showFeedback, setVoltMessage]);

  // ── Handle node click in circuit diagram ──
  const handleNodeClick = useCallback((node: NodeId) => {
    if (phase !== 'wire' || !selectedWire) return;

    // Pole→Meter segment is pre-wired — skip pole as "from" in user interactions
    // (pole can be clicked to preview the service cable)
    if (node === 'pole') {
      showFeedback('🗼 Pole is pre-connected by the utility company. Start from Meter!', 'info');
      return;
    }

    // Check component is placed (for meter/switch/mcb nodes)
    if ((node === 'meter' && !placedComponents.has('meter')) ||
        (node === 'switch' && !placedComponents.has('switch'))) {
      showFeedback(`❌ Place the ${NODE_LABELS[node]} component first!`, 'error');
      const scene = sceneRef.current;
      if (scene) createSpark(scene, new THREE.Vector3(-8.8, 4, -5));
      return;
    }

    if (!connectingFrom) {
      // First click — select "from"
      if (node === 'house') {
        showFeedback('🏠 House is the endpoint. Select a source component first.', 'info');
        return;
      }
      setConnectingFrom(node);
      showFeedback(`📌 ${NODE_LABELS[node]} selected as source. Now click the next component.`, 'info');
      return;
    }

    // Second click — try to connect
    if (connectingFrom === node) {
      setConnectingFrom(null);
      showFeedback('ℹ️ Deselected. Click a component to start wiring.', 'info');
      return;
    }

    const key = `${selectedWire}_${connectingFrom}_${node}`;
    const reverseKey = `${selectedWire}_${node}_${connectingFrom}`;

    if (connections.has(key) || connections.has(reverseKey)) {
      setConnectingFrom(null);
      showFeedback('✅ This wire is already connected!', 'info');
      return;
    }

    // Check if this is a valid adjacent pair
    const validPair = ADJACENT.find(
      ([f, t]) => (f === connectingFrom && t === node) || (f === node && t === connectingFrom),
    );

    if (!validPair) {
      setConnectingFrom(null);
      const scene = sceneRef.current;
      if (scene) createSpark(scene, new THREE.Vector3(-6, 5, -2));
      showFeedback('⚡ Invalid connection! Components must be adjacent in the circuit.', 'error');
      setVoltMessage('⚡ Wrong connection! Electricity flows: Pole→Meter→Switch→MCB→House. Connect in order!');
      return;
    }

    // Normalize order
    const [from, to] = validPair;

    // Check user_segments only (pole→meter is auto)
    const isUserSegment = USER_SEGMENTS.some(([f, t]) => f === from && t === to);
    if (!isUserSegment) {
      setConnectingFrom(null);
      showFeedback('🗼 Pole→Meter is already wired by the utility. Move on!', 'info');
      return;
    }

    const canonKey = `${selectedWire}_${from}_${to}`;

    // Draw wire in 3D
    const scene = sceneRef.current;
    if (scene && !wireMeshes.current[canonKey]) {
      const pts = getWirePath(from, to, selectedWire);
      if (pts.length >= 2) {
        const mesh = addTube(scene, pts, WIRE_META[selectedWire].three, 0.065);
        wireMeshes.current[canonKey] = mesh;
      }
    }

    setConnections(prev => {
      const next = new Set(prev);
      next.add(canonKey);
      return next;
    });
    setConnectingFrom(null);
    addScore(25);

    const tip = WIRE_TIPS[canonKey] ?? `✅ ${WIRE_META[selectedWire].name} wire: ${NODE_LABELS[from]} → ${NODE_LABELS[to]}`;
    showFeedback(tip, 'success');
    setVoltMessage(tip);
  }, [phase, selectedWire, connectingFrom, connections, placedComponents, addScore, showFeedback, setVoltMessage]);

  // ── Check circuit completion ──
  useEffect(() => {
    if (!allWiresComplete || circuitComplete || !allComponentsPlaced) return;
    completedRef.current = true;
    setCircuitComplete(true);
    setPhase('done');

    // Light up bulbs
    const scene = sceneRef.current;
    if (scene) {
      ['hall', 'bed', 'kit'].forEach(room => {
        const bulb = refs3d.current[`bulb_${room}`];
        if (bulb) {
          const mat = (bulb as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0xffee44);
          mat.emissiveIntensity = 1.5;
        }
        const light = refs3d.current[`ceilLight_${room}`] as THREE.PointLight;
        if (light) light.intensity = 3;
        // TV screens
        const tv = refs3d.current[`tvScreen_${room}`];
        if (tv) {
          const mat = (tv as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0x1a44cc);
          mat.emissiveIntensity = 1.5;
        }
      });
      // Service cable glow
      const cable = refs3d.current['serviceCable'] as THREE.Mesh;
      if (cable) {
        const mat = cable.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0xffcc00);
        mat.emissive.setHex(0xffcc00);
        mat.emissiveIntensity = 0.6;
      }
    }

    setTimeout(() => {
      setLevelComplete(true);
      addStar();
      addScore(100);
      setVoltMessage('🎉 House fully wired! All lights on, fans spinning, TVs glowing — 240V flowing safely!');
    }, 1000);
  }, [allWiresComplete, allComponentsPlaced, circuitComplete]);

  // ── Transition to wire phase ──
  useEffect(() => {
    if (allComponentsPlaced && phase === 'place') {
      setPhase('wire');
      setVoltMessage('🔌 All components placed! Now select a wire type and connect the circuit: Meter → Switch → MCB → House');
    }
  }, [allComponentsPlaced, phase]);

  const wireTypes: WireType[] = ['phase', 'neutral', 'earth'];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#f0f4f8 0%,#e8eef4 100%)' }} />
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* ── Feedback Toast ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.text}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-16 left-1/2 z-50 pointer-events-none"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div
              className="px-5 py-3 rounded-2xl font-bold shadow-xl text-sm"
              style={{
                background:
                  feedback.type === 'success' ? '#dcfce7'
                  : feedback.type === 'error' ? '#fee2e2'
                  : '#eff6ff',
                color:
                  feedback.type === 'success' ? '#166534'
                  : feedback.type === 'error' ? '#991b1b'
                  : '#1e40af',
                border: `2px solid ${feedback.type === 'success' ? '#22c55e' : feedback.type === 'error' ? '#ef4444' : '#3b82f6'}`,
                maxWidth: 380,
                textAlign: 'center',
              }}
            >
              {feedback.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left Panel: Toolkit ── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 flex flex-col pointer-events-auto overflow-y-auto"
        style={{
          width: 'clamp(220px, 25vw, 295px)',
          background: 'rgba(255,255,255,0.97)',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '4px 0 20px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-2 font-bold text-white flex-shrink-0"
          style={{
            background: phase === 'wire' || phase === 'done'
              ? 'linear-gradient(135deg,#10b981,#059669)'
              : 'linear-gradient(135deg,#0ea5e9,#3b82f6)',
            fontSize: '1rem',
          }}
        >
          {phase === 'place' ? '🔧 Place Components' : phase === 'wire' ? '🔌 Wire the Circuit' : '✅ Wired!'}
        </div>

        <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">

          {/* ── Phase 1: Component placement ── */}
          <div>
            <p
              className="font-bold uppercase tracking-widest mb-2 px-1"
              style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.1em' }}
            >
              Components
            </p>
            {(['meter', 'switch', 'mcb'] as ComponentId[]).map(id => {
              const placed = placedComponents.has(id);
              const info = COMPONENT_INFO[id];
              const isPrePlaced = id === 'mcb'; // MCB is always visible in scene
              return (
                <motion.button
                  key={id}
                  onClick={() => { if (!placed) placeComponent(id); }}
                  whileHover={!placed ? { scale: 1.02, x: 3 } : {}}
                  whileTap={!placed ? { scale: 0.97 } : {}}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-left mb-1.5"
                  style={{
                    background: placed ? '#f0fdf4' : '#f8fafc',
                    border: `2px solid ${placed ? '#86efac' : '#e2e8f0'}`,
                    cursor: placed ? 'default' : 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{info.icon}</span>
                  <div className="flex-1">
                    <p
                      className="font-bold"
                      style={{ fontSize: '0.88rem', color: placed ? '#059669' : '#334155' }}
                    >
                      {info.title}
                      {isPrePlaced && !placed && ' *'}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {placed ? 'Installed ✓' : isPrePlaced ? 'Confirm placement' : 'Click to install'}
                    </p>
                  </div>
                  {placed && <span className="text-green-500 font-bold">✓</span>}
                </motion.button>
              );
            })}
          </div>

          {/* ── Phase 2: Wire type selector ── */}
          {(phase === 'wire' || phase === 'done') && (
            <div>
              <p
                className="font-bold uppercase tracking-widest mb-2 px-1"
                style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.1em' }}
              >
                Wire Type
              </p>
              {wireTypes.map(w => {
                const meta = WIRE_META[w];
                const done = wireComplete(w);
                const active = selectedWire === w;
                return (
                  <motion.button
                    key={w}
                    onClick={() => {
                      if (phase !== 'wire') return;
                      setSelectedWire(w);
                      setConnectingFrom(null);
                    }}
                    whileHover={!done ? { scale: 1.02 } : {}}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl w-full text-left mb-1.5"
                    style={{
                      background: done ? '#f0fdf4' : active ? `${meta.color}18` : '#f8fafc',
                      border: `2.5px solid ${done ? '#86efac' : active ? meta.color : '#e2e8f0'}`,
                      cursor: done ? 'default' : 'pointer',
                    }}
                  >
                    <div
                      className="rounded-full flex-shrink-0"
                      style={{ width: 14, height: 14, background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                    />
                    <div className="flex-1">
                      <p
                        className="font-bold"
                        style={{ fontSize: '0.85rem', color: done ? '#059669' : active ? meta.color : '#334155' }}
                      >
                        {meta.name} Wire
                      </p>
                      <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{meta.label}</p>
                    </div>
                    {done && <span className="text-green-500 text-sm font-bold">✓✓✓</span>}
                    {active && !done && <span style={{ fontSize: '0.7rem', color: meta.color, fontWeight: 700 }}>ACTIVE</span>}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ── Circuit Diagram: connection nodes ── */}
          {(phase === 'wire' || phase === 'done') && (
            <div>
              <p
                className="font-bold uppercase tracking-widest mb-2 px-1"
                style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.1em' }}
              >
                {selectedWire ? `Connect ${WIRE_META[selectedWire].name} Wire` : 'Select a wire type above'}
              </p>

              {/* Node buttons in circuit chain */}
              <div className="flex flex-col gap-1.5">
                {(['pole', 'meter', 'switch', 'mcb', 'house'] as NodeId[]).map((node, idx) => {
                  const isFrom = connectingFrom === node;
                  const isPlaced =
                    node === 'pole' || node === 'house'
                    || placedComponents.has(node as ComponentId);
                  const color = selectedWire ? WIRE_META[selectedWire].color : '#94a3b8';
                  return (
                    <React.Fragment key={node}>
                      <motion.button
                        onClick={() => handleNodeClick(node)}
                        whileHover={selectedWire && isPlaced ? { scale: 1.03, x: 2 } : {}}
                        whileTap={selectedWire && isPlaced ? { scale: 0.97 } : {}}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl w-full text-left"
                        style={{
                          background: isFrom ? `${color}22` : isPlaced ? '#f8fafc' : '#f1f5f9',
                          border: `2px solid ${isFrom ? color : isPlaced ? '#cbd5e1' : '#e2e8f0'}`,
                          boxShadow: isFrom ? `0 0 12px ${color}66` : 'none',
                          cursor: selectedWire && isPlaced ? 'pointer' : 'default',
                          opacity: isPlaced ? 1 : 0.5,
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{NODE_ICONS[node]}</span>
                        <span
                          className="font-bold flex-1"
                          style={{ fontSize: '0.82rem', color: isFrom ? color : '#334155' }}
                        >
                          {NODE_LABELS[node]}
                        </span>
                        {isFrom && (
                          <span className="text-xs font-bold" style={{ color }}>FROM</span>
                        )}
                        {node === 'pole' && (
                          <span className="text-xs text-green-600 font-bold">Pre-wired</span>
                        )}
                      </motion.button>

                      {/* Show segment connection status between nodes */}
                      {idx < 4 && selectedWire && (() => {
                        const nextNode = (['pole', 'meter', 'switch', 'mcb', 'house'] as NodeId[])[idx + 1];
                        const segKey = `${selectedWire}_${node}_${nextNode}`;
                        const isConnected = connections.has(segKey);
                        const isPreWired = node === 'pole'; // pole→meter
                        return (
                          <div className="flex items-center gap-1 px-3">
                            <div
                              className="flex-1 rounded-full"
                              style={{
                                height: 4,
                                background: isConnected || isPreWired
                                  ? WIRE_META[selectedWire].color
                                  : '#e2e8f0',
                                boxShadow: isConnected ? `0 0 6px ${WIRE_META[selectedWire].color}` : 'none',
                                transition: 'background 0.4s',
                              }}
                            />
                            {(isConnected || isPreWired) && (
                              <span className="text-xs font-bold" style={{ color: WIRE_META[selectedWire].color }}>✓</span>
                            )}
                          </div>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Wire legend ── */}
          <div
            className="rounded-xl p-3 mt-1"
            style={{ background: '#fafafa', border: '1.5px solid #e2e8f0' }}
          >
            <p className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.8rem' }}>Wire Color Code</p>
            {wireTypes.map(w => (
              <div key={w} className="flex items-center gap-2 mb-1">
                <div
                  className="rounded-full flex-shrink-0"
                  style={{ width: 10, height: 10, background: WIRE_META[w].color }}
                />
                <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                  <strong>{WIRE_META[w].name}:</strong> {WIRE_META[w].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-700" style={{ fontSize: '0.82rem' }}>
              {phase === 'place' ? 'Components Placed' : 'Wiring Progress'}
            </span>
            <span className="font-bold" style={{
              color: circuitComplete ? '#059669' : '#3b82f6',
              fontSize: '0.9rem',
            }}>
              {phase === 'place'
                ? `${placedComponents.size}/3`
                : `${connectedCount}/${totalRequired}`}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: '#e2e8f0' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: circuitComplete ? 'linear-gradient(90deg,#22c55e,#10b981)' : 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
              animate={{
                width: phase === 'place'
                  ? `${(placedComponents.size / 3) * 100}%`
                  : `${progress}%`,
              }}
              transition={{ duration: 0.4 }}
            />
          </div>
          {circuitComplete && (
            <p className="text-center font-bold text-green-600 mt-1.5" style={{ fontSize: '0.82rem' }}>
              🎉 House fully powered!
            </p>
          )}
        </div>
      </div>

      {/* ── Right Info Panel ── */}
      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(200px, 22vw, 270px)', paddingBottom: '0.25rem' }}
      >
        <InfoCard title="Home Wiring" icon="🏠" colorClass="from-orange-600 to-amber-500">
          <p><strong>Circuit Flow:</strong> Pole → Meter → Switch → MCB → Rooms</p>
          <p><strong>Phase (Red):</strong> Live 240V — powers appliances.</p>
          <p><strong>Neutral (Blue):</strong> Returns current to grid.</p>
          <p><strong>Earth (Green):</strong> Safety — diverts fault current.</p>
        </InfoCard>

        {/* Wire status cards */}
        {wireTypes.map(w => {
          const done = wireComplete(w);
          const meta = WIRE_META[w];
          const count = USER_SEGMENTS.filter(([f, t]) => connections.has(`${w}_${f}_${t}`)).length;
          return (
            <div
              key={w}
              className="game-panel"
              style={{ border: `2px solid ${done ? meta.color : '#e2e8f0'}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="rounded-full"
                  style={{ width: 12, height: 12, background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                />
                <span className="font-bold text-slate-800" style={{ fontSize: '0.88rem' }}>
                  {meta.name} Wire
                </span>
                {done && <span style={{ color: meta.color, fontSize: '0.85rem', marginLeft: 'auto' }}>✓ Done</span>}
              </div>
              <div className="flex gap-1">
                {USER_SEGMENTS.map(([f, t]) => {
                  const segKey = `${w}_${f}_${t}`;
                  const connected = connections.has(segKey);
                  return (
                    <div
                      key={segKey}
                      className="flex-1 rounded-full"
                      style={{
                        height: 6,
                        background: connected ? meta.color : '#e2e8f0',
                        boxShadow: connected ? `0 0 5px ${meta.color}` : 'none',
                        transition: 'background 0.3s',
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {USER_SEGMENTS.map(([f, t]) => (
                  <span key={`${f}_${t}`} style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                    {NODE_ICONS[f]}→{NODE_ICONS[t]}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 4 }}>
                {count}/{USER_SEGMENTS.length} segments
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Bottom hint ── */}
      <AnimatePresence>
        {!circuitComplete && phase === 'place' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 295px)',
              right: 'clamp(200px, 22vw, 270px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.3, repeat: Infinity }}
            >
              <div
                className="px-4 py-2.5 rounded-full font-bold text-slate-900"
                style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '0.9rem', boxShadow: '0 0 18px rgba(255,215,0,0.5)' }}
              >
                👈 Click components to place them in the house!
              </div>
            </motion.div>
          </motion.div>
        )}
        {!circuitComplete && phase === 'wire' && !selectedWire && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 295px)',
              right: 'clamp(200px, 22vw, 270px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.3, repeat: Infinity }}
            >
              <div
                className="px-4 py-2.5 rounded-full font-bold text-slate-900"
                style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '0.9rem', boxShadow: '0 0 18px rgba(255,215,0,0.5)' }}
              >
                👈 Select a wire type to start connecting!
              </div>
            </motion.div>
          </motion.div>
        )}
        {!circuitComplete && phase === 'wire' && selectedWire && !connectingFrom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 295px)',
              right: 'clamp(200px, 22vw, 270px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              className="px-4 py-2.5 rounded-full font-bold"
              style={{ background: WIRE_META[selectedWire].color, color: '#fff', fontSize: '0.9rem', boxShadow: `0 0 18px ${WIRE_META[selectedWire].color}88` }}
            >
              Click a source node → then click the next node to connect!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
