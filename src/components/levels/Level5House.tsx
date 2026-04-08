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

const ADJACENT: [NodeId, NodeId][] = [
  ['pole',   'meter'],
  ['meter',  'switch'],
  ['switch', 'mcb'],
  ['mcb',    'house'],
];

const USER_SEGMENTS: [NodeId, NodeId][] = [
  ['meter',  'switch'],
  ['switch', 'mcb'],
  ['mcb',    'house'],
];

const NODE_ICONS: Record<NodeId, string> = {
  pole:   '🗼',
  meter:  '📊',
  switch: '🔴',
  mcb:    '🛡️',
  house:  '🏠',
};

const NODE_LABELS: Record<NodeId, string> = {
  pole:   'Utility Pole',
  meter:  'Electric Meter',
  switch: 'Main Switch',
  mcb:    'MCB Panel',
  house:  'House Circuit',
};

const COMPONENT_INFO: Record<ComponentId, { title: string; icon: string; tip: string }> = {
  meter:  { icon: '📊', title: 'Electric Meter',  tip: '⚡ Counts every kWh! 1 kWh = 1000W for 1 hour.' },
  switch: { icon: '🔴', title: 'Main Switch',      tip: '🔴 ALWAYS turn this OFF before any electrical work!' },
  mcb:    { icon: '🛡️', title: 'MCB Panel',       tip: '🛡️ Breakers trip in 0.01s — faster than a heartbeat!' },
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

// Y-offsets so the 3 wire types sit beside each other
const Y_OFFSETS: Record<WireType, number> = { phase: 0.12, neutral: 0, earth: -0.12 };

// ─────────────────────────────────────────────────────────────
// Wire paths (world-space, matched to Level5House scene)
// ─────────────────────────────────────────────────────────────

function getWirePath(from: NodeId, to: NodeId, wire: WireType): THREE.Vector3[] {
  const yo = Y_OFFSETS[wire];
  const paths: Record<string, THREE.Vector3[]> = {
    pole_meter: [
      new THREE.Vector3(-10, 11.5 + yo, 0),
      new THREE.Vector3(-8.8, 9.5 + yo, -1),
      new THREE.Vector3(-8.4, 7.5 + yo, -1),
      new THREE.Vector3(-8.35, 4.5 + yo, -1),
    ],
    meter_switch: [
      new THREE.Vector3(-8.0, 3.5 + yo, -1),
      new THREE.Vector3(-7.8, 3.6 + yo, -1.8),
      new THREE.Vector3(-7.7, 3.5 + yo, -2.5),
    ],
    switch_mcb: [
      new THREE.Vector3(-7.6, 3.5 + yo, -2.5),
      new THREE.Vector3(-7.4, 3.6 + yo, -3.1),
      new THREE.Vector3(-7.2, 3.8 + yo, -3.6),
    ],
    mcb_house: [
      new THREE.Vector3(-6.9, 7.0 + yo, -3.6),
      new THREE.Vector3(-3, 7.0 + yo, -3.5),
      new THREE.Vector3(0,   7.0 + yo, -3.5),
      new THREE.Vector3(5,   7.0 + yo, -3.5),
    ],
  };
  return paths[`${from}_${to}`] ?? [];
}

// ─────────────────────────────────────────────────────────────
// Tube helper
// ─────────────────────────────────────────────────────────────

function addTube(
  scene: THREE.Scene,
  pts: THREE.Vector3[],
  color: number,
  r = 0.065,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 24, r, 7, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
// Full scene builder (house geometry preserved exactly)
// ─────────────────────────────────────────────────────────────

function buildFullScene(
  scene: THREE.Scene,
  refs: Record<string, THREE.Object3D | null>,
) {
  // Grass
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ color: 0x7cc05a, roughness: 0.9 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.15;
  scene.add(grass);

  // Concrete slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.4, 9),
    new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.7 }),
  );
  slab.position.set(0, 0, 0);
  scene.add(slab);

  const wallMat     = new THREE.MeshStandardMaterial({ color: 0xf7f3ee, roughness: 0.55, metalness: 0.02 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd5c8ba, roughness: 0.7 });
  const glassMat    = new THREE.MeshStandardMaterial({ color: 0x8ec8e8, transparent: true, opacity: 0.35, metalness: 0.2 });

  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat = wallMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Walls
  addBox(16, 7.5, 0.4, 0, 4.05, -4.2);                                                  // back wall
  addBox(0.4, 7.5, 9, -8, 4.05, 0);                                                      // left wall
  addBox(0.4, 7.5, 9,  8, 4.05, 0);                                                      // right wall
  addBox(3, 7.5, 0.35, -2.5, 4.05, -0.5, concreteMat);                                   // interior divider L
  addBox(3, 7.5, 0.35,  3.5, 4.05, -0.5, concreteMat);                                   // interior divider R

  // Flat modern roof
  addBox(17.5, 0.5, 10.5, 0, 8.05, 0,
    new THREE.MeshStandardMaterial({ color: 0x607080, roughness: 0.5, metalness: 0.1 }));
  // Parapet walls
  addBox(17.6, 0.8, 0.25, 0, 8.7, -5.1,
    new THREE.MeshStandardMaterial({ color: 0x777060, roughness: 0.6 }));
  addBox(17.6, 0.8, 0.25, 0, 8.7,  5.1,
    new THREE.MeshStandardMaterial({ color: 0x777060, roughness: 0.6 }));

  // Large modern windows
  addBox(3.5, 2.8, 0.25, -5, 4.2, 4.4, glassMat);
  addBox(3.5, 2.8, 0.25,  3, 4.2, 4.4, glassMat);
  // Window frames
  addBox(3.7, 3.0, 0.15, -5, 4.2, 4.3,
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }));
  addBox(3.7, 3.0, 0.15,  3, 4.2, 4.3,
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }));
  addBox(3.4, 2.7, 0.25, -5, 4.2, 4.45, glassMat);
  addBox(3.4, 2.7, 0.25,  3, 4.2, 4.45, glassMat);

  // Front door
  addBox(1.8, 3.5, 0.2, 0, 2.05, 4.4,
    new THREE.MeshStandardMaterial({ color: 0x3b5278, roughness: 0.3, metalness: 0.3 }));
  // Door handle
  addBox(0.08, 0.08, 0.2, 0.7, 2.0, 4.55,
    new THREE.MeshStandardMaterial({ color: 0xddbb44, metalness: 0.9, roughness: 0.1 }));

  // Pathway
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xc0b8a0, roughness: 0.9 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, -0.12, 7.5);
  scene.add(path);

  // ── Utility Pole (always visible) ──
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 13, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 }),
  );
  pole.position.set(-10, 6.5, 0);
  scene.add(pole);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6a4a30 }),
  );
  arm.position.set(-10, 11.5, 0);
  scene.add(arm);
  [-0.8, 0.8].forEach(dx => {
    const ins = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x9090bb }),
    );
    ins.position.set(-10 + dx, 11.3, 0);
    scene.add(ins);
  });

  // Service cable — pre-wired by utility (dim until circuit complete)
  const serviceCable = addTube(scene, [
    new THREE.Vector3(-10, 11.5, 0),
    new THREE.Vector3(-8.8, 9.5, -1),
    new THREE.Vector3(-8.4, 7.5, -1),
    new THREE.Vector3(-8.35, 4.5, -1),
  ], 0x555555, 0.06);
  (serviceCable.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  refs['serviceCable'] = serviceCable;

  // ── Electric Meter (hidden until placed) ──
  const meterGroup = new THREE.Group();
  const mPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 3.4, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.4 }),
  );
  mPlate.position.set(-8.35, 3.5, -1);
  const mCasing = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 3.0, 2.0),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }),
  );
  mCasing.position.set(-8.1, 3.5, -1);
  const mLcd = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.6, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xc8f0d0, roughness: 0.2 }),
  );
  mLcd.position.set(-7.85, 3.8, -1);
  const mDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xfafafa }),
  );
  mDial.rotation.z = Math.PI / 2;
  mDial.position.set(-7.85, 3.0, -1);
  const mNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.45, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xcc3333 }),
  );
  mNeedle.position.set(-7.82, 3.0, -1);
  mNeedle.rotation.x = Math.PI / 6;
  const mStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.3, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  mStrip.position.set(-7.85, 2.2, -1);
  meterGroup.add(mPlate, mCasing, mLcd, mDial, mNeedle, mStrip);
  meterGroup.visible = false;
  scene.add(meterGroup);
  refs['meter3d'] = meterGroup;

  // ── Main Switch (hidden until placed) ──
  const switchGroup = new THREE.Group();
  const sw = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.0, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xbb2020, roughness: 0.5 }),
  );
  sw.position.set(-7.6, 3.5, -2.5);
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 1.0, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  lever.position.set(-7.35, 4.2, -2.5);
  const swLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x22dd44, emissive: 0x22dd44, emissiveIntensity: 0.8 }),
  );
  swLed.position.set(-7.35, 3.0, -2.5);
  switchGroup.add(sw, lever, swLed);
  switchGroup.visible = false;
  scene.add(switchGroup);
  refs['switch3d'] = switchGroup;

  // ── MCB Panel (hidden until placed) ──
  const mcbGroup = new THREE.Group();
  const mcbEnc = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 4.0, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.2 }),
  );
  mcbEnc.position.set(-7.2, 3.8, -3.6);
  const mcbFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 3.5, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x334155 }),
  );
  mcbFace.position.set(-6.9, 3.8, -3.6);
  const mcbLbl = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.3, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xffd700 }),
  );
  mcbLbl.position.set(-6.88, 5.4, -3.6);
  const cols = [0x22c55e, 0x22c55e, 0xf59e0b, 0xf59e0b, 0x3b82f6, 0x3b82f6];
  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.9, 0.35),
      new THREE.MeshStandardMaterial({ color: cols[i] }),
    );
    br.position.set(-6.88, 3.6, -4.1 + i * 0.45);
    mcbGroup.add(br);
  }
  mcbGroup.add(mcbEnc, mcbFace, mcbLbl);
  mcbGroup.visible = false;
  scene.add(mcbGroup);
  refs['mcb3d'] = mcbGroup;

  // ── Interior Bulb (inside house, hanging from ceiling) ──
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xddddaa, roughness: 0.3 }),
  );
  bulb.position.set(0, 7.5, 0);
  scene.add(bulb);
  refs['bulb'] = bulb;

  // Bulb socket/cord
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333 }),
  );
  cord.position.set(0, 8.0, 0);
  scene.add(cord);

  // Point light for the bulb (off by default)
  const bulbLight = new THREE.PointLight(0xfff5cc, 0, 18);
  bulbLight.position.set(0, 7.5, 0);
  scene.add(bulbLight);
  refs['bulbLight'] = bulbLight;

  // Second bulb in left room
  const bulb2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xddddaa, roughness: 0.3 }),
  );
  bulb2.position.set(-5, 7.5, 0);
  scene.add(bulb2);
  refs['bulb2'] = bulb2;
  const bulbLight2 = new THREE.PointLight(0xfff5cc, 0, 14);
  bulbLight2.position.set(-5, 7.5, 0);
  scene.add(bulbLight2);
  refs['bulbLight2'] = bulbLight2;

  // Third bulb in right room
  const bulb3 = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xddddaa, roughness: 0.3 }),
  );
  bulb3.position.set(5, 7.5, 0);
  scene.add(bulb3);
  refs['bulb3'] = bulb3;
  const bulbLight3 = new THREE.PointLight(0xfff5cc, 0, 14);
  bulbLight3.position.set(5, 7.5, 0);
  scene.add(bulbLight3);
  refs['bulbLight3'] = bulbLight3;

  // Floating label sprites (simple colored planes as label anchors)
  const makeLabel = (x: number, y: number, z: number, color: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.18),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  refs['labelMeter']  = makeLabel(-7.5, 5.2, -1,   0x8b5cf6);
  refs['labelSwitch'] = makeLabel(-7.0, 5.2, -2.5, 0xef4444);
  refs['labelMcb']    = makeLabel(-6.5, 5.8, -3.6, 0x059669);
}

// ─────────────────────────────────────────────────────────────
// Spark effect
// ─────────────────────────────────────────────────────────────

function createSpark(scene: THREE.Scene, pos: THREE.Vector3): () => void {
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 2.5 }),
    );
    m.position.copy(pos);
    scene.add(m);
    sparks.push(m);
  }
  const velocities = sparks.map(() => new THREE.Vector3(
    (Math.random() - 0.5) * 3.5,
    Math.random() * 3.5 + 1,
    (Math.random() - 0.5) * 3.5,
  ));
  let t = 0;
  const interval = setInterval(() => {
    t += 0.05;
    sparks.forEach((s, i) => {
      s.position.addScaledVector(velocities[i], 0.05);
      velocities[i].y -= 0.12;
      s.scale.setScalar(Math.max(0, 1 - t * 1.6));
    });
    if (t > 0.8) {
      clearInterval(interval);
      sparks.forEach(s => scene.remove(s));
    }
  }, 30);
  return () => { clearInterval(interval); sparks.forEach(s => scene.remove(s)); };
}

// ─────────────────────────────────────────────────────────────
// Electricity flow particle
// ─────────────────────────────────────────────────────────────

function createFlowParticles(
  scene: THREE.Scene,
  wireMeshes: THREE.Mesh[],
): () => void {
  const particles: THREE.Mesh[] = [];
  wireMeshes.forEach(wire => {
    const mat = wire.material as THREE.MeshStandardMaterial;
    let t = 0;
    const interval = setInterval(() => {
      t += 0.018;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 6) * 0.45;
    }, 30);
    (wire as any).__flowInterval = interval;
  });
  return () => {
    wireMeshes.forEach(wire => clearInterval((wire as any).__flowInterval));
    particles.forEach(p => scene.remove(p));
  };
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export const Level5House = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const sceneRef   = useRef<THREE.Scene | null>(null);
  const refs3d     = useRef<Record<string, THREE.Object3D | null>>({});
  const wireMeshes = useRef<Record<string, THREE.Mesh>>({});
  const completedRef = useRef(false);

  const [placedComponents, setPlacedComponents] = useState<Set<ComponentId>>(new Set());
  const [selectedWire, setSelectedWire]         = useState<WireType | null>(null);
  const [connectingFrom, setConnectingFrom]     = useState<NodeId | null>(null);
  const [connections, setConnections]           = useState<Set<string>>(new Set());
  const [feedback, setFeedback]                 = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [circuitComplete, setCircuitComplete]   = useState(false);
  const [phase, setPhase]                       = useState<'place' | 'wire' | 'done'>('place');

  // Derived
  const allComponentsPlaced = placedComponents.has('meter') && placedComponents.has('switch') && placedComponents.has('mcb');
  const totalRequired = USER_SEGMENTS.length * 3;
  const connectedCount = connections.size;
  const progress = Math.round((connectedCount / totalRequired) * 100);

  const wireComplete = (wire: WireType) =>
    USER_SEGMENTS.every(([f, t]) => connections.has(`${wire}_${f}_${t}`));
  const allWiresComplete = (['phase', 'neutral', 'earth'] as WireType[]).every(wireComplete);

  // ── Init scene ──
  useEffect(() => {
    if (!containerRef.current) return;
    const { scene, camera, renderer, controls, cleanup } = initBasicScene(containerRef.current);
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xd0eaf8);
    scene.fog = new THREE.FogExp2(0xd0eaf8, 0.012);
    camera.position.set(0, 10, 24);
    camera.fov = 52;
    camera.updateProjectionMatrix();
    controls.target.set(0, 4, 0);
    controls.maxPolarAngle = Math.PI / 2.1;

    buildFullScene(scene, refs3d.current);
    setVoltMessage('🏠 Home Wiring Sim! Place the electrical components, then connect the wires to power the house!');

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); cleanup(); sceneRef.current = null; };
  }, []);

  // ── Toast helper ──
  const showFeedback = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3400);
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

  // ── Handle node click for wiring ──
  const handleNodeClick = useCallback((node: NodeId) => {
    if (phase !== 'wire' || !selectedWire) return;

    if (node === 'pole') {
      showFeedback('🗼 Pole is pre-connected by the utility. Start from Meter!', 'info');
      return;
    }

    if ((node === 'meter' && !placedComponents.has('meter')) ||
        (node === 'switch' && !placedComponents.has('switch')) ||
        (node === 'mcb'    && !placedComponents.has('mcb'))) {
      showFeedback(`❌ Place the ${NODE_LABELS[node]} component first!`, 'error');
      const scene = sceneRef.current;
      if (scene) createSpark(scene, new THREE.Vector3(-7.6, 4, -3));
      return;
    }

    if (!connectingFrom) {
      if (node === 'house') {
        showFeedback('🏠 House is the endpoint. Select a source component first.', 'info');
        return;
      }
      setConnectingFrom(node);
      showFeedback(`📌 ${NODE_LABELS[node]} selected. Now click the next component.`, 'info');
      return;
    }

    if (connectingFrom === node) {
      setConnectingFrom(null);
      showFeedback('ℹ️ Deselected. Click a component to start wiring.', 'info');
      return;
    }

    const key        = `${selectedWire}_${connectingFrom}_${node}`;
    const reverseKey = `${selectedWire}_${node}_${connectingFrom}`;

    if (connections.has(key) || connections.has(reverseKey)) {
      setConnectingFrom(null);
      showFeedback('✅ This wire is already connected!', 'info');
      return;
    }

    const validPair = ADJACENT.find(
      ([f, t]) => (f === connectingFrom && t === node) || (f === node && t === connectingFrom),
    );

    if (!validPair) {
      setConnectingFrom(null);
      const scene = sceneRef.current;
      if (scene) createSpark(scene, new THREE.Vector3(-6, 5, -2));
      showFeedback('⚡ Invalid connection! Components must be adjacent: Pole→Meter→Switch→MCB→House.', 'error');
      setVoltMessage('⚡ Wrong connection! Follow the flow: Pole → Meter → Switch → MCB → House');
      return;
    }

    const [from, to] = validPair;
    const isUserSegment = USER_SEGMENTS.some(([f, t]) => f === from && t === to);
    if (!isUserSegment) {
      setConnectingFrom(null);
      showFeedback('🗼 Pole → Meter is pre-wired by the utility. Move on!', 'info');
      return;
    }

    const canonKey = `${selectedWire}_${from}_${to}`;

    // Check missing earth warning
    if (selectedWire !== 'earth' && from === 'mcb' && to === 'house') {
      const earthDone = wireComplete('earth');
      if (!earthDone && connections.size >= totalRequired - 3) {
        showFeedback('⚠️ Warning: Don\'t forget the Earth wire! Missing earth = shock hazard!', 'error');
      }
    }

    // Draw in 3D
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
  }, [phase, selectedWire, connectingFrom, connections, placedComponents, wireComplete, addScore, showFeedback, setVoltMessage, totalRequired]);

  // ── Transition to wiring phase ──
  useEffect(() => {
    if (allComponentsPlaced && phase === 'place') {
      setPhase('wire');
      setVoltMessage('🔌 All components placed! Select a wire type and connect: Meter → Switch → MCB → House');
    }
  }, [allComponentsPlaced, phase]);

  // ── Check completion ──
  useEffect(() => {
    if (!allWiresComplete || circuitComplete || !allComponentsPlaced) return;
    completedRef.current = true;
    setCircuitComplete(true);
    setPhase('done');

    const scene = sceneRef.current;
    if (scene) {
      // Light up all bulbs
      ['bulb', 'bulb2', 'bulb3'].forEach((key, i) => {
        const bulb = refs3d.current[key];
        if (bulb) {
          const mat = (bulb as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.color.setHex(0xffff88);
          mat.emissive.setHex(0xffee44);
          mat.emissiveIntensity = 2.0;
        }
        const light = refs3d.current[`${key}Light`] as THREE.PointLight;
        if (light) light.intensity = i === 0 ? 5 : 3.5;
      });

      // Glow service cable
      const cable = refs3d.current['serviceCable'] as THREE.Mesh;
      if (cable) {
        const mat = cable.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0xffcc00);
        mat.emissive.setHex(0xffcc00);
        mat.emissiveIntensity = 0.7;
      }

      // Animate wire pulse
      const allWires = Object.values(wireMeshes.current);
      createFlowParticles(scene, allWires);
    }

    setTimeout(() => {
      setLevelComplete(true);
      addStar();
      addScore(150);
      setVoltMessage('🎉 House fully wired! All lights on — 240V flowing safely through Phase, Neutral & Earth!');
    }, 1200);
  }, [allWiresComplete, allComponentsPlaced, circuitComplete]);

  const wireTypes: WireType[] = ['phase', 'neutral', 'earth'];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#d0eaf8 0%,#b8d8ee 100%)' }} />
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* ── Feedback Toast ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.text}
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="absolute top-16 left-1/2 z-50 pointer-events-none"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div
              className="px-5 py-3 rounded-2xl font-bold shadow-xl"
              style={{
                fontSize: '0.88rem',
                background:
                  feedback.type === 'success' ? '#dcfce7'
                  : feedback.type === 'error' ? '#fee2e2'
                  : '#eff6ff',
                color:
                  feedback.type === 'success' ? '#166534'
                  : feedback.type === 'error' ? '#991b1b'
                  : '#1e40af',
                border: `2px solid ${feedback.type === 'success' ? '#22c55e' : feedback.type === 'error' ? '#ef4444' : '#3b82f6'}`,
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              {feedback.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT: Toolkit Panel ── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 flex flex-col pointer-events-auto overflow-hidden"
        style={{
          width: 'clamp(220px, 25vw, 290px)',
          background: 'rgba(255,255,255,0.97)',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '4px 0 20px rgba(0,0,0,0.09)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 font-bold text-white flex items-center gap-2 flex-shrink-0"
          style={{
            background: phase === 'done'
              ? 'linear-gradient(135deg,#22c55e,#16a34a)'
              : phase === 'wire'
              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
              : 'linear-gradient(135deg,#3b82f6,#2563eb)',
            fontSize: '0.98rem',
          }}
        >
          {phase === 'place' ? '🔧 Toolkit — Place Components' : phase === 'wire' ? '🔌 Connect the Wires' : '✅ House Powered!'}
        </div>

        <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">

          {/* Components section */}
          <div>
            <p className="font-bold uppercase tracking-widest mb-2 px-1"
              style={{ fontSize: '0.6rem', color: '#94a3b8', letterSpacing: '0.1em' }}>
              Components
            </p>
            {(['meter', 'switch', 'mcb'] as ComponentId[]).map(id => {
              const placed = placedComponents.has(id);
              const info = COMPONENT_INFO[id];
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
                  <span style={{ fontSize: '1.25rem' }}>{info.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold" style={{ fontSize: '0.87rem', color: placed ? '#059669' : '#334155' }}>
                      {info.title}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {placed ? '✓ Snapped into position' : 'Click to drag & place'}
                    </p>
                  </div>
                  {placed && <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>}
                </motion.button>
              );
            })}
          </div>

          {/* Wire type selector */}
          {(phase === 'wire' || phase === 'done') && (
            <div>
              <p className="font-bold uppercase tracking-widest mb-2 px-1"
                style={{ fontSize: '0.6rem', color: '#94a3b8', letterSpacing: '0.1em' }}>
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
                      style={{ width: 14, height: 14, background: meta.color, boxShadow: `0 0 7px ${meta.color}` }}
                    />
                    <div className="flex-1">
                      <p className="font-bold" style={{ fontSize: '0.84rem', color: done ? '#059669' : active ? meta.color : '#334155' }}>
                        {meta.name} Wire
                      </p>
                      <p style={{ fontSize: '0.67rem', color: '#94a3b8' }}>{meta.label}</p>
                    </div>
                    {done && <span style={{ color: '#22c55e', fontSize: '0.82rem', fontWeight: 700 }}>✓✓✓</span>}
                    {active && !done && <span style={{ fontSize: '0.68rem', color: meta.color, fontWeight: 700 }}>ACTIVE</span>}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Circuit node buttons */}
          {(phase === 'wire' || phase === 'done') && (
            <div>
              <p className="font-bold uppercase tracking-widest mb-2 px-1"
                style={{ fontSize: '0.6rem', color: '#94a3b8', letterSpacing: '0.1em' }}>
                {selectedWire ? `Connect ${WIRE_META[selectedWire].name} Wire` : 'Select wire type above ↑'}
              </p>
              <div className="flex flex-col gap-1.5">
                {(['pole', 'meter', 'switch', 'mcb', 'house'] as NodeId[]).map((node, idx) => {
                  const isFrom = connectingFrom === node;
                  const isPlaced =
                    node === 'pole' || node === 'house' || placedComponents.has(node as ComponentId);
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
                          boxShadow: isFrom ? `0 0 14px ${color}55` : 'none',
                          cursor: selectedWire && isPlaced ? 'pointer' : 'default',
                          opacity: isPlaced ? 1 : 0.45,
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{NODE_ICONS[node]}</span>
                        <span className="font-bold flex-1" style={{ fontSize: '0.81rem', color: isFrom ? color : '#334155' }}>
                          {NODE_LABELS[node]}
                        </span>
                        {isFrom && <span style={{ fontSize: '0.65rem', fontWeight: 700, color }}>FROM</span>}
                        {node === 'pole' && <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 700 }}>Pre-wired</span>}
                      </motion.button>

                      {/* Segment connector line */}
                      {idx < 4 && selectedWire && (() => {
                        const nextNode = (['pole', 'meter', 'switch', 'mcb', 'house'] as NodeId[])[idx + 1];
                        const segKey = `${selectedWire}_${node}_${nextNode}`;
                        const isConnected = connections.has(segKey);
                        const isPreWired = node === 'pole';
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
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: WIRE_META[selectedWire].color }}>✓</span>
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

          {/* Wire legend */}
          <div className="rounded-xl p-3 mt-1" style={{ background: '#fafafa', border: '1.5px solid #e2e8f0' }}>
            <p className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.79rem' }}>
              🔴🔵🟢 Wire Color Code
            </p>
            {wireTypes.map(w => (
              <div key={w} className="flex items-center gap-2 mb-1.5">
                <div className="rounded-full flex-shrink-0"
                  style={{ width: 10, height: 10, background: WIRE_META[w].color, boxShadow: `0 0 5px ${WIRE_META[w].color}` }} />
                <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                  <strong>{WIRE_META[w].name}:</strong> {WIRE_META[w].label}
                </span>
              </div>
            ))}
          </div>

          {/* Safety tips */}
          <div className="rounded-xl p-3" style={{ background: '#fef9c3', border: '1.5px solid #fde047' }}>
            <p className="font-bold mb-1" style={{ fontSize: '0.75rem', color: '#854d0e' }}>⚠️ Safety Rules</p>
            <p style={{ fontSize: '0.68rem', color: '#713f12', lineHeight: 1.5 }}>
              • Always turn Main Switch OFF before work<br />
              • Earth wire is mandatory — no exceptions<br />
              • Phase (Red) = 240V live — never touch!<br />
              • MCB trips in 0.01s to prevent fires
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-700" style={{ fontSize: '0.8rem' }}>
              {phase === 'place' ? 'Components Placed' : 'Wiring Progress'}
            </span>
            <span className="font-bold" style={{
              color: circuitComplete ? '#059669' : phase === 'place' ? '#3b82f6' : '#f59e0b',
              fontSize: '0.88rem',
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

      {/* ── RIGHT: Info & Wire Status Panel ── */}
      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(195px, 21vw, 260px)', paddingBottom: '0.25rem' }}
      >
        <InfoCard title="Home Wiring" icon="🏠" colorClass="from-orange-600 to-amber-500">
          <p><strong>Circuit Flow:</strong></p>
          <p style={{ fontSize: '0.75rem' }}>Pole → Meter → Switch → MCB → House</p>
          <p className="mt-1"><strong>Phase (Red):</strong> 240V live — powers everything.</p>
          <p><strong>Neutral (Blue):</strong> Returns current safely.</p>
          <p><strong>Earth (Green):</strong> Fault-current safety path.</p>
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
                <div className="rounded-full"
                  style={{ width: 12, height: 12, background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                <span className="font-bold text-slate-800" style={{ fontSize: '0.86rem' }}>
                  {meta.name} Wire
                </span>
                {done && <span style={{ color: meta.color, fontSize: '0.8rem', marginLeft: 'auto', fontWeight: 700 }}>✓ Done</span>}
              </div>
              <div className="flex gap-1 mb-1">
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
              <div className="flex justify-between">
                {USER_SEGMENTS.map(([f, t]) => (
                  <span key={`${f}_${t}`} style={{ fontSize: '0.58rem', color: '#94a3b8' }}>
                    {NODE_ICONS[f]}→{NODE_ICONS[t]}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: 4 }}>
                {count}/{USER_SEGMENTS.length} segments connected
              </p>
            </div>
          );
        })}

        {/* Bulb status card */}
        <div className="game-panel" style={{ border: `2px solid ${circuitComplete ? '#fbbf24' : '#e2e8f0'}` }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <div>
              <p className="font-bold text-slate-800" style={{ fontSize: '0.86rem' }}>House Bulbs</p>
              <p style={{ fontSize: '0.7rem', color: circuitComplete ? '#d97706' : '#94a3b8', fontWeight: circuitComplete ? 700 : 400 }}>
                {circuitComplete ? '✨ Glowing — circuit complete!' : 'Off — complete wiring to power on'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom animated hint ── */}
      <AnimatePresence>
        {!circuitComplete && phase === 'place' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 290px)',
              right: 'clamp(195px, 21vw, 260px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 1.3, repeat: Infinity }}>
              <div
                className="px-5 py-2.5 rounded-full font-bold text-slate-900"
                style={{
                  background: 'linear-gradient(135deg,#ffd700,#f59e0b)',
                  fontSize: '0.88rem',
                  boxShadow: '0 0 18px rgba(255,215,0,0.5)',
                }}
              >
                👈 Click components to snap them into the house!
              </div>
            </motion.div>
          </motion.div>
        )}
        {!circuitComplete && phase === 'wire' && !selectedWire && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 290px)',
              right: 'clamp(195px, 21vw, 260px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 1.3, repeat: Infinity }}>
              <div
                className="px-5 py-2.5 rounded-full font-bold text-slate-900"
                style={{
                  background: 'linear-gradient(135deg,#ffd700,#f59e0b)',
                  fontSize: '0.88rem',
                  boxShadow: '0 0 18px rgba(255,215,0,0.5)',
                }}
              >
                👈 Choose a wire colour to start connecting!
              </div>
            </motion.div>
          </motion.div>
        )}
        {!circuitComplete && phase === 'wire' && selectedWire && connectingFrom && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-5 z-20 pointer-events-none"
            style={{
              left: 'clamp(220px, 25vw, 290px)',
              right: 'clamp(195px, 21vw, 260px)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              className="px-5 py-2.5 rounded-full font-bold"
              style={{
                background: WIRE_META[selectedWire].color,
                color: '#fff',
                fontSize: '0.88rem',
                boxShadow: `0 0 18px ${WIRE_META[selectedWire].color}88`,
              }}
            >
              🔌 {NODE_LABELS[connectingFrom]} selected — click next component!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
