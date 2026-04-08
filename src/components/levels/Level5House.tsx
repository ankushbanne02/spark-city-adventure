import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ATTACH: Record<string, [number, number, number]> = {
  meter:  [-8.1, 5.0, -1.0],
  switch: [-7.6, 5.0, -2.5],
  mcb:    [-7.2, 6.2, -3.6],
  house:  [ 0.0, 5.5,  0.0],
};

const CONNECTION_FLOW = ['meter-switch', 'switch-mcb', 'mcb-house'] as const;

const TOOLKIT_ITEMS = [
  { id: 'meter',  label: 'Electric Meter', sublabel: '240V Input',    icon: '📊', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)'  },
  { id: 'switch', label: 'Main Switch',    sublabel: 'Isolator',      icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  { id: 'mcb',    label: 'MCB Panel',      sublabel: 'Distribution',  icon: '🛡️', color: '#059669', bg: 'rgba(5,150,105,0.15)'   },
  { id: 'wire',   label: 'Wire Tool',      sublabel: 'Connect nodes', icon: '〰️', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
];

const REQUIRED_ITEMS = ['meter', 'switch', 'mcb'];

const STEP_EXPLANATIONS = [
  {
    title: 'Meter → Main Switch Connected!',
    icon: '📊',
    color: 'from-violet-700 to-violet-500',
    info: 'The Electric Meter now feeds into the Main Isolator Switch via 3 wires: Phase (Red/240V live), Neutral (Blue/return path), and Earth (Green/safety ground). ALWAYS turn the Main Switch OFF before any electrical work!',
    formula: '3-Wire System',
    formulaNote: 'Phase + Neutral + Earth = Safe Circuit!',
  },
  {
    title: 'Switch → MCB Panel Connected!',
    icon: '🛡️',
    color: 'from-emerald-700 to-emerald-500',
    info: 'Power now enters the MCB Distribution Board. Each breaker protects a different room circuit. If a fault occurs the MCB trips in just 0.01 seconds — faster than a heartbeat — preventing fires and shocks!',
    formula: 'Trip time: 0.01 s',
    formulaNote: 'Faster than a heartbeat — fires prevented!',
  },
  {
    title: '🏠 House Fully Wired!',
    icon: '⚡',
    color: 'from-amber-600 to-yellow-400',
    info: 'All 3 wires now reach every room! Lights on, fans spin, appliances run safely. Remember: the Earth wire is NEVER optional — it diverts fault current safely to ground and can save your life!',
    formula: 'P = V × I = 240 × I',
    formulaNote: 'Every watt starts from the Utility Pole!',
  },
];

// Room MCB labels
const ROOM_LABELS = ['Room 1 – Lights', 'Room 2 – Fan', 'Room 3 – Socket'];
const ROOM_ICONS  = ['💡', '🌀', '🔌'];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED 3-D HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const WireTube = ({
  start, end, color, active, flash = false,
}: {
  start: [number,number,number]; end: [number,number,number];
  color: string; active: boolean; flash?: boolean;
}) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const colorHex = useMemo(() => new THREE.Color(color), [color]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3(
      (start[0]+end[0])/2,
      Math.max(start[1], end[1]) + 0.4,
      (start[2]+end[2])/2,
    ),
    new THREE.Vector3(...end),
  ]), [start, end]);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = flash
      ? 0.6 + Math.sin(clock.getElapsedTime() * 18) * 0.5
      : active ? 0.5 + Math.sin(clock.getElapsedTime() * 2.5) * 0.2 : 0;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 22, 0.072, 8, false]} />
      <meshStandardMaterial ref={matRef}
        color={active ? colorHex : new THREE.Color('#888888')}
        emissive={active ? colorHex : new THREE.Color('#000')}
        emissiveIntensity={0} metalness={0.3} roughness={0.5} />
    </mesh>
  );
};

const WireBundle = ({
  fromId, toId, active, flash = false,
}: {
  fromId: string; toId: string; active: boolean; flash?: boolean;
}) => {
  const s = NODE_ATTACH[fromId];
  const e = NODE_ATTACH[toId];
  const wires = [
    { color: '#ef4444', yo:  0.10 },
    { color: '#3b82f6', yo:  0.00 },
    { color: '#22c55e', yo: -0.10 },
  ];
  return (
    <>
      {wires.map((w, i) => (
        <WireTube key={i}
          start={[s[0], s[1] + w.yo, s[2]]}
          end={[e[0], e[1] + w.yo, e[2]]}
          color={w.color} active={active} flash={flash} />
      ))}
    </>
  );
};

const ElectricParticles = ({
  fromId, toId, active,
}: {
  fromId: string; toId: string; active: boolean;
}) => {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 28;
  const posRef = useRef(new Float32Array(COUNT * 3));
  const tRef = useRef<number[]>([]);
  const s = NODE_ATTACH[fromId];
  const e = NODE_ATTACH[toId];
  const mid: [number,number,number] = [
    (s[0]+e[0])/2, Math.max(s[1],e[1])+0.4, (s[2]+e[2])/2,
  ];
  useEffect(() => { tRef.current = Array.from({ length: COUNT }, () => Math.random()); }, []);
  useFrame((_, dt) => {
    if (!active || !ref.current) return;
    const arr = posRef.current; const ts = tRef.current;
    for (let i = 0; i < COUNT; i++) {
      ts[i] = (ts[i] + dt * 0.55) % 1; const t = ts[i];
      arr[i*3]   = (1-t)*(1-t)*s[0] + 2*(1-t)*t*mid[0] + t*t*e[0];
      arr[i*3+1] = (1-t)*(1-t)*s[1] + 2*(1-t)*t*mid[1] + t*t*e[1];
      arr[i*3+2] = (1-t)*(1-t)*s[2] + 2*(1-t)*t*mid[2] + t*t*e[2];
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#fbbf24" size={0.28} transparent opacity={active ? 1 : 0} depthWrite={false} />
    </points>
  );
};

const Label3D = ({ position, text, active, yOffset = 0 }: {
  position: [number,number,number]; text: string; active: boolean; yOffset?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = position[1] + yOffset + Math.sin(clock.getElapsedTime() * 1.4) * 0.2;
  });
  return (
    <group ref={groupRef} position={[position[0], position[1] + yOffset, position[2]]}>
      <Html center distanceFactor={26} zIndexRange={[10,0]}>
        <div style={{
          pointerEvents:'none', whiteSpace:'nowrap', padding:'3px 10px', borderRadius:'16px',
          fontSize:'10px', fontWeight:700, fontFamily:'system-ui,sans-serif',
          background: active
            ? 'linear-gradient(135deg,rgba(251,191,36,0.95),rgba(245,158,11,0.95))'
            : 'rgba(15,23,42,0.82)',
          color: active ? '#1c1917' : '#cbd5e1',
          border: active ? '1.5px solid #fbbf24' : '1.5px solid rgba(100,116,139,0.4)',
          boxShadow: active ? '0 0 10px rgba(251,191,36,0.55)' : '0 1px 6px rgba(0,0,0,0.3)',
        }}>
          {text}
        </div>
      </Html>
    </group>
  );
};

const PulsingRing = ({ position, color = '#22d3ee' }: {
  position: [number,number,number]; color?: string;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.28;
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshStandardMaterial).opacity =
      0.55 - Math.sin(clock.getElapsedTime() * 3) * 0.22;
  });
  return (
    <mesh ref={ref} position={[position[0], position[1]+0.05, position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[1.4, 2.0, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2}
        transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
};

const SourceHalo = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.22;
    ref.current.scale.setScalar(s);
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      1.2 + Math.sin(clock.getElapsedTime() * 4) * 0.5;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5}
        transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
};

const SparkBurst = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 24;
  const posArr = useMemo(() => new Float32Array(COUNT * 3), []);
  const velRef = useRef<[number,number,number][]>([]);
  const lifeRef = useRef(0);
  useEffect(() => {
    velRef.current = Array.from({length: COUNT}, () => [
      (Math.random()-0.5)*7, Math.random()*5+1, (Math.random()-0.5)*7,
    ] as [number,number,number]);
    lifeRef.current = 0;
    for (let i = 0; i < COUNT; i++) {
      posArr[i*3]=position[0]; posArr[i*3+1]=position[1]; posArr[i*3+2]=position[2];
    }
  }, [position, posArr]);
  useFrame((_, dt) => {
    if (!ref.current || lifeRef.current > 1.2) return;
    lifeRef.current += dt;
    velRef.current.forEach(([vx,vy,vz], i) => {
      posArr[i*3] += vx*dt; posArr[i*3+1] += (vy - lifeRef.current*5)*dt; posArr[i*3+2] += vz*dt;
    });
    ref.current.geometry.attributes.position.needsUpdate = true;
    (ref.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - lifeRef.current/0.9);
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffd700" size={0.42} transparent opacity={1} depthWrite={false} />
    </points>
  );
};

const GroundRipple = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const life = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current += dt;
    ref.current.scale.set(1+life.current*4, 1, 1+life.current*4);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - life.current*0.75);
  });
  return (
    <mesh ref={ref} position={[position[0], 0.06, position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.4, 1.1, 32]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
};

const ErrorRing = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const life = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current += dt;
    const s = 1 + Math.sin(life.current * 22) * 0.18;
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - life.current*1.6);
  });
  return (
    <mesh ref={ref} position={[position[0], 0.1, position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[1.8, 3.0, 32]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
};

const DraggableWire = ({ start, end }: {
  start: [number,number,number]; end: [number,number,number];
}) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3((start[0]+end[0])/2, Math.max(start[1],end[1])+0.3, (start[2]+end[2])/2),
    new THREE.Vector3(...end),
  ]), [start, end]);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 0.4 + Math.sin(clock.getElapsedTime()*10)*0.35;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.08, 8, false]} />
      <meshStandardMaterial ref={matRef} color="#22d3ee" emissive="#22d3ee"
        emissiveIntensity={0.5} transparent opacity={0.88} metalness={0.2} roughness={0.4} />
    </mesh>
  );
};

const DragPlane = ({ active, onMove, onRelease }: {
  active: boolean; onMove: (pt: THREE.Vector3) => void; onRelease: () => void;
}) => {
  if (!active) return null;
  return (
    <mesh position={[0, 5.5, 0]} rotation={[-Math.PI/2, 0, 0]}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.point); }}
      onPointerUp={(e) => { e.stopPropagation(); onRelease(); }}>
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

const DropZone = ({ position, label, isHighlighted, placed }: {
  position: [number,number,number]; label: string; isHighlighted: boolean; placed: boolean;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = placed ? 0
      : isHighlighted ? 0.55 + Math.sin(clock.getElapsedTime()*4)*0.3
      : 0.2 + Math.sin(clock.getElapsedTime()*2)*0.1;
  });
  if (placed) return null;
  return (
    <group position={position}>
      <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[1.2, 2.4, 32]} />
        <meshBasicMaterial color={isHighlighted ? '#60a5fa' : '#94a3b8'}
          transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={22} zIndexRange={[5, 0]}>
        <div style={{
          pointerEvents:'none', whiteSpace:'nowrap', fontSize:'9px', fontWeight:700,
          color: isHighlighted ? '#93c5fd' : '#94a3b8', fontFamily:'system-ui,sans-serif',
          background:'rgba(15,23,42,0.78)', padding:'3px 8px', borderRadius:'10px',
          border:`1px dashed ${isHighlighted ? '#60a5fa' : '#475569'}`,
          boxShadow: isHighlighted ? '0 0 8px rgba(96,165,250,0.4)' : 'none',
        }}>
          Drop {label} here
        </div>
      </Html>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE GEOMETRY (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const HouseMeshes = () => (
  <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#7cc05a" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[16, 0.4, 9]} />
      <meshStandardMaterial color="#d8cfc0" roughness={0.7} />
    </mesh>
    <mesh position={[0, 4.05, -4.2]} castShadow receiveShadow>
      <boxGeometry args={[16, 7.5, 0.4]} />
      <meshStandardMaterial color="#f7f3ee" roughness={0.55} metalness={0.02} />
    </mesh>
    <mesh position={[-8, 4.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.4, 7.5, 9]} />
      <meshStandardMaterial color="#f7f3ee" roughness={0.55} metalness={0.02} />
    </mesh>
    <mesh position={[8, 4.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.4, 7.5, 9]} />
      <meshStandardMaterial color="#f7f3ee" roughness={0.55} metalness={0.02} />
    </mesh>
    <mesh position={[-2.5, 4.05, -0.5]} castShadow receiveShadow>
      <boxGeometry args={[3, 7.5, 0.35]} />
      <meshStandardMaterial color="#d5c8ba" roughness={0.7} />
    </mesh>
    <mesh position={[3.5, 4.05, -0.5]} castShadow receiveShadow>
      <boxGeometry args={[3, 7.5, 0.35]} />
      <meshStandardMaterial color="#d5c8ba" roughness={0.7} />
    </mesh>
    <mesh position={[0, 8.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[17.5, 0.5, 10.5]} />
      <meshStandardMaterial color="#607080" roughness={0.5} metalness={0.1} />
    </mesh>
    <mesh position={[0, 8.7, -5.1]} castShadow>
      <boxGeometry args={[17.6, 0.8, 0.25]} />
      <meshStandardMaterial color="#777060" roughness={0.6} />
    </mesh>
    <mesh position={[0, 8.7, 5.1]} castShadow>
      <boxGeometry args={[17.6, 0.8, 0.25]} />
      <meshStandardMaterial color="#777060" roughness={0.6} />
    </mesh>
    <mesh position={[-5, 4.2, 4.4]}>
      <boxGeometry args={[3.5, 2.8, 0.25]} />
      <meshStandardMaterial color="#8ec8e8" transparent opacity={0.35} metalness={0.2} />
    </mesh>
    <mesh position={[3, 4.2, 4.4]}>
      <boxGeometry args={[3.5, 2.8, 0.25]} />
      <meshStandardMaterial color="#8ec8e8" transparent opacity={0.35} metalness={0.2} />
    </mesh>
    <mesh position={[-5, 4.2, 4.3]}>
      <boxGeometry args={[3.7, 3.0, 0.15]} />
      <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[3, 4.2, 4.3]}>
      <boxGeometry args={[3.7, 3.0, 0.15]} />
      <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[-5, 4.2, 4.45]}>
      <boxGeometry args={[3.4, 2.7, 0.25]} />
      <meshStandardMaterial color="#8ec8e8" transparent opacity={0.35} metalness={0.2} />
    </mesh>
    <mesh position={[3, 4.2, 4.45]}>
      <boxGeometry args={[3.4, 2.7, 0.25]} />
      <meshStandardMaterial color="#8ec8e8" transparent opacity={0.35} metalness={0.2} />
    </mesh>
    <mesh position={[0, 2.05, 4.4]} castShadow>
      <boxGeometry args={[1.8, 3.5, 0.2]} />
      <meshStandardMaterial color="#3b5278" roughness={0.3} metalness={0.3} />
    </mesh>
    <mesh position={[0.7, 2.0, 4.55]}>
      <boxGeometry args={[0.08, 0.08, 0.2]} />
      <meshStandardMaterial color="#ddbb44" metalness={0.9} roughness={0.1} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.12, 7.5]}>
      <planeGeometry args={[2.5, 6]} />
      <meshStandardMaterial color="#c0b8a0" roughness={0.9} />
    </mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY POLE + SERVICE CABLE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const UtilityPole = ({ serviceActive }: { serviceActive: boolean }) => {
  const cableMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    if (!cableMatRef.current) return;
    if (serviceActive) {
      cableMatRef.current.color.set('#ffcc00');
      cableMatRef.current.emissive.set('#ffcc00');
      cableMatRef.current.emissiveIntensity = 0.4 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    } else {
      cableMatRef.current.color.set('#555555');
      cableMatRef.current.emissive.set('#000000');
      cableMatRef.current.emissiveIntensity = 0;
    }
  });
  const cableCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10, 11.5, 0),
    new THREE.Vector3(-8.8, 9.5, -0.5),
    new THREE.Vector3(-8.4, 7.0, -1.0),
    new THREE.Vector3(-8.2, 5.2, -1.0),
  ]), []);
  return (
    <group>
      <mesh position={[-10, 6.5, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 13, 12]} />
        <meshStandardMaterial color="#5a3a20" roughness={0.9} />
      </mesh>
      <mesh position={[-10, 11.5, 0]}>
        <boxGeometry args={[3.0, 0.2, 0.2]} />
        <meshStandardMaterial color="#6a4a30" />
      </mesh>
      {([-0.8, 0.8] as number[]).map((dx, i) => (
        <mesh key={i} position={[-10 + dx, 11.3, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.4, 8]} />
          <meshStandardMaterial color="#9090bb" />
        </mesh>
      ))}
      <mesh>
        <tubeGeometry args={[cableCurve, 24, 0.06, 7, false]} />
        <meshStandardMaterial ref={cableMatRef} color="#555555" emissive="#000" emissiveIntensity={0} />
      </mesh>
      <Label3D position={[-10, 14, 0]} text="Utility Pole (240 V)" active={serviceActive} yOffset={0} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTOR JOINT — glowing ball at each node attach point
// ─────────────────────────────────────────────────────────────────────────────

const ConnectorJoint = ({ position, active }: {
  position: [number,number,number]; active: boolean;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = active
      ? 1.2 + Math.sin(clock.getElapsedTime() * 3) * 0.4
      : 0.15;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.18, 12, 12]} />
      <meshStandardMaterial
        color={active ? '#fbbf24' : '#475569'}
        emissive={active ? '#fbbf24' : '#1e293b'}
        emissiveIntensity={0.15}
        metalness={0.6} roughness={0.2}
      />
    </mesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ELECTRICAL COMPONENTS — ELECTRIC METER (with animated dial & kWh)
// ─────────────────────────────────────────────────────────────────────────────

const ElectricMeter3D = ({ placed, isWireSource, isWireTarget, onWireDragStart, powerFlowing, kwhDisplay }: {
  placed: boolean; isWireSource: boolean; isWireTarget: boolean;
  onWireDragStart: () => void; powerFlowing: boolean; kwhDisplay: string;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  const dialRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (placed && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt * 4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
    // Rotate dial when power is flowing
    if (dialRef.current && powerFlowing) {
      dialRef.current.rotation.x += dt * 2.5;
    }
  });
  if (!placed) return null;
  return (
    <group ref={groupRef} position={[-8.1, 3.5, -1]}
      onPointerDown={(e) => { if (isWireSource) { e.stopPropagation(); onWireDragStart(); } }}
      onPointerOver={() => { setHovered(true); if (isWireSource) document.body.style.cursor = 'crosshair'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {isWireSource && <PulsingRing position={[0, -3.4, 0]} color="#22d3ee" />}
      {isWireTarget && <PulsingRing position={[0, -3.4, 0]} color="#4ade80" />}
      {/* Mounting plate */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 3.4, 2.4]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.4}
          emissive={isWireSource && hovered ? '#22d3ee' : '#000'}
          emissiveIntensity={isWireSource && hovered ? 0.35 : 0} />
      </mesh>
      {/* White casing */}
      <mesh position={[0.32, 0, 0]}>
        <boxGeometry args={[0.5, 3.0, 2.0]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.3} />
      </mesh>
      {/* LCD display — shows kWh */}
      <mesh position={[0.6, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.6, 1.3]} />
        <meshStandardMaterial
          color={powerFlowing ? '#00ff88' : '#c8f0d0'}
          emissive={powerFlowing ? '#00ff88' : '#000'}
          emissiveIntensity={powerFlowing ? 0.6 : 0}
          roughness={0.2} />
      </mesh>
      {/* kWh label */}
      <Html position={[0.72, 0.3, 0]} center distanceFactor={18} zIndexRange={[8,0]}>
        <div style={{
          pointerEvents:'none', fontSize:'7px', fontWeight:800, color:'#003300',
          fontFamily:'monospace', background:'rgba(0,255,136,0.85)', padding:'1px 3px', borderRadius:'3px',
        }}>
          {kwhDisplay} kWh
        </div>
      </Html>
      {/* Rotating dial */}
      <mesh ref={dialRef} position={[0.6, -0.55, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 20]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* Dial arrow marker */}
      <mesh position={[0.65, -0.35, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      {/* kWh strip */}
      <mesh position={[0.6, -1.1, 0]}>
        <boxGeometry args={[0.1, 0.3, 1.8]} />
        <meshStandardMaterial color="#ffd700" />
      </mesh>
      {/* Connector joint */}
      <ConnectorJoint position={[NODE_ATTACH['meter'][0] - (-8.1), NODE_ATTACH['meter'][1] - 3.5, NODE_ATTACH['meter'][2] - (-1)]} active={powerFlowing} />
      {isWireSource && <SourceHalo position={NODE_ATTACH['meter']} />}
      <Label3D position={[0, 2.5, 0]} text="📊 Electric Meter" active yOffset={0.5} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SWITCH — clickable ON/OFF toggle
// ─────────────────────────────────────────────────────────────────────────────

const MainSwitch3D = ({ placed, isWireSource, isWireTarget, onWireDragStart, switchOn, onToggle, wired }: {
  placed: boolean; isWireSource: boolean; isWireTarget: boolean;
  onWireDragStart: () => void; switchOn: boolean; onToggle: () => void; wired: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  const ledRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (placed && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt * 4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = switchOn
        ? 0.8 + Math.sin(Date.now() / 400) * 0.2
        : 0.1;
    }
  });
  if (!placed) return null;
  return (
    <group ref={groupRef} position={[-7.6, 3.5, -2.5]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (isWireSource) { onWireDragStart(); return; }
        if (wired) onToggle();
      }}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = wired ? 'pointer' : (isWireSource ? 'crosshair' : 'default');
      }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {isWireSource && <PulsingRing position={[0, -3.4, 0]} color="#22d3ee" />}
      {isWireTarget && <PulsingRing position={[0, -3.4, 0]} color="#4ade80" />}
      {/* Red body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 2.0, 1.1]} />
        <meshStandardMaterial color={switchOn ? '#bb2020' : '#4a4a4a'} roughness={0.5}
          emissive={isWireSource && hovered ? '#22d3ee' : hovered && wired ? '#ffaa00' : '#000'}
          emissiveIntensity={hovered ? 0.3 : 0} />
      </mesh>
      {/* Yellow lever — tilted based on on/off */}
      <mesh position={[0.22, switchOn ? 0.38 : -0.38, 0]}
        rotation-z={switchOn ? 0 : Math.PI / 5}>
        <boxGeometry args={[0.15, 1.0, 0.25]} />
        <meshStandardMaterial color="#ffd700" />
      </mesh>
      {/* LED */}
      <mesh ref={ledRef} position={[0.22, -0.45, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial
          color={switchOn ? '#22dd44' : '#ff4444'}
          emissive={switchOn ? '#22dd44' : '#ff4444'}
          emissiveIntensity={0.9} />
      </mesh>
      {/* ON/OFF label */}
      {wired && (
        <Html position={[0.5, 0, 0]} center distanceFactor={16} zIndexRange={[8,0]}>
          <div style={{
            pointerEvents:'none', fontSize:'8px', fontWeight:800,
            color: switchOn ? '#22ff44' : '#ff4444',
            background:'rgba(0,0,0,0.7)', padding:'2px 5px', borderRadius:'4px',
            fontFamily:'monospace', whiteSpace:'nowrap',
          }}>
            {switchOn ? 'ON' : 'OFF'}
          </div>
        </Html>
      )}
      {/* Connector joint */}
      <ConnectorJoint position={[NODE_ATTACH['switch'][0] - (-7.6), NODE_ATTACH['switch'][1] - 3.5, NODE_ATTACH['switch'][2] - (-2.5)]} active={switchOn && wired} />
      {isWireSource && <SourceHalo position={NODE_ATTACH['switch']} />}
      {isWireTarget && (
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2.5} transparent opacity={0.7} />
        </mesh>
      )}
      <Label3D position={[0, 2.2, 0]} text={wired ? (switchOn ? '🔴 Switch: ON' : '⚫ Switch: OFF') : '🔴 Main Switch'} active={switchOn} yOffset={0.5} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MCB PANEL — 3 clickable room breakers
// ─────────────────────────────────────────────────────────────────────────────

const MCBPanel3D = ({ placed, isWireSource, isWireTarget, active, onWireDragStart, breakers, onBreakerToggle, wired }: {
  placed: boolean; isWireSource: boolean; isWireTarget: boolean; active: boolean;
  onWireDragStart: () => void;
  breakers: [boolean, boolean, boolean]; onBreakerToggle: (i: number) => void; wired: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const breakerColors = ['#22c55e', '#f59e0b', '#3b82f6'];

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (placed && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt * 4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });
  if (!placed) return null;
  return (
    <group ref={groupRef} position={[-7.2, 3.8, -3.6]}
      onPointerDown={(e) => { if (isWireSource) { e.stopPropagation(); onWireDragStart(); } }}
      onPointerOver={() => { setHovered(true); if (isWireSource) document.body.style.cursor = 'crosshair'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {isWireSource && <PulsingRing position={[0, -3.7, 0]} color="#22d3ee" />}
      {isWireTarget && <PulsingRing position={[0, -3.7, 0]} color="#4ade80" />}
      {/* Enclosure */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 4.0, 3.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.2}
          emissive={isWireSource && hovered ? '#22d3ee' : isWireTarget ? '#4ade80' : '#000'}
          emissiveIntensity={hovered || isWireTarget ? 0.25 : 0} />
      </mesh>
      {/* Face plate */}
      <mesh position={[0.25, 0, 0]}>
        <boxGeometry args={[0.12, 3.5, 2.8]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Label strip */}
      <mesh position={[0.3, 1.65, 0]}>
        <boxGeometry args={[0.06, 0.3, 2.6]} />
        <meshStandardMaterial color="#ffd700" />
      </mesh>
      {/* 3 clickable room breakers (top half) */}
      {breakers.map((on, i) => (
        <mesh key={i}
          position={[0.3, 0.7 - i * 0.65, 0]}
          onPointerDown={(e) => { if (wired) { e.stopPropagation(); onBreakerToggle(i); } }}
          onPointerOver={(e) => { if (wired) { e.stopPropagation(); document.body.style.cursor = 'pointer'; } }}
          onPointerOut={() => { document.body.style.cursor = 'default'; }}
        >
          <boxGeometry args={[0.32, 0.55, 0.38]} />
          <meshStandardMaterial
            color={on ? breakerColors[i] : '#374151'}
            emissive={on ? breakerColors[i] : '#000'}
            emissiveIntensity={on && active ? 0.7 : 0.05} />
        </mesh>
      ))}
      {/* 3 decorative breakers (bottom half) */}
      {[0x475569, 0x475569, 0x475569].map((c, i) => (
        <mesh key={`dec-${i}`} position={[0.3, -1.3 - i * 0.42, 0]}>
          <boxGeometry args={[0.28, 0.36, 0.32]} />
          <meshStandardMaterial color={`#${c.toString(16).padStart(6,'0')}`} emissiveIntensity={0.05} />
        </mesh>
      ))}
      {/* Room labels on breakers */}
      {wired && breakers.map((on, i) => (
        <Html key={`lbl-${i}`} position={[0.5, 0.7 - i * 0.65, 0]} center distanceFactor={14} zIndexRange={[8,0]}>
          <div style={{
            pointerEvents:'none', fontSize:'6px', fontWeight:800, whiteSpace:'nowrap',
            color: on ? '#fff' : '#9ca3af',
            background: on ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
            padding:'1px 3px', borderRadius:'3px', fontFamily:'monospace',
          }}>
            R{i+1} {on ? '✓' : '✗'}
          </div>
        </Html>
      ))}
      {/* Connector joint */}
      <ConnectorJoint position={[NODE_ATTACH['mcb'][0] - (-7.2), NODE_ATTACH['mcb'][1] - 3.8, NODE_ATTACH['mcb'][2] - (-3.6)]} active={active} />
      {isWireSource && <SourceHalo position={NODE_ATTACH['mcb']} />}
      {isWireTarget && (
        <mesh position={[0, 2.6, 0]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2.5} transparent opacity={0.7} />
        </mesh>
      )}
      <Label3D position={[0, 2.8, 0]} text="🛡️ MCB Panel" active yOffset={0.5} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE ENDPOINT NODE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const HouseEndpoint = ({ active, isWireTarget }: { active: boolean; isWireTarget: boolean }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      active ? 0.8 + Math.sin(clock.getElapsedTime() * 3) * 0.4 : isWireTarget ? 1.2 : 0.15;
  });
  return (
    <group position={[0, 5.5, 0]}>
      {isWireTarget && <PulsingRing position={[0, -5.4, 0]} color="#4ade80" />}
      <mesh ref={ref} castShadow>
        <boxGeometry args={[1.0, 0.8, 0.6]} />
        <meshStandardMaterial color={active ? '#ffd700' : '#1e293b'}
          emissive={active ? '#ffd700' : isWireTarget ? '#4ade80' : '#334155'}
          emissiveIntensity={0.15} metalness={0.3} />
      </mesh>
      {isWireTarget && (
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2.5} transparent opacity={0.7} />
        </mesh>
      )}
      <Label3D position={[0, 1.2, 0]} text="🏠 House Circuit" active={active} yOffset={0.5} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CEILING BULBS — original 3 bulbs (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const SingleBulb = ({ position, active, intensity }: {
  position: [number,number,number]; active: boolean; intensity: number;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = active ? 1.5 + Math.sin(clock.getElapsedTime() * 2.2) * 0.3 : 0;
  });
  return (
    <group>
      <mesh position={[position[0], position[1] + 0.45, position[2]]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh ref={ref} position={position}>
        <sphereGeometry args={[0.32, 14, 14]} />
        <meshStandardMaterial
          color={active ? '#ffff88' : '#ddddaa'}
          emissive="#ffee44" emissiveIntensity={0} roughness={0.3} />
      </mesh>
      <pointLight position={position} color="#fff5cc" intensity={active ? intensity : 0} distance={16} />
    </group>
  );
};

const CeilingBulbs = ({ active }: { active: boolean }) => (
  <>
    <SingleBulb position={[0,  7.6, 0]} active={active} intensity={5.0} />
    <SingleBulb position={[-5, 7.6, 1]} active={active} intensity={3.5} />
    <SingleBulb position={[5,  7.6, 1]} active={active} intensity={3.5} />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// ROOM APPLIANCES — per-room MCB-controlled devices
// ─────────────────────────────────────────────────────────────────────────────

// Room 1 (left): Bulb
const Room1Bulb = ({ active }: { active: boolean }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = active ? 2.0 + Math.sin(clock.getElapsedTime() * 2) * 0.4 : 0;
    mat.color.set(active ? '#ffff88' : '#cccc99');
  });
  return (
    <group position={[-5, 7.5, -2]}>
      {/* Cord */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Socket base */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.18, 10]} />
        <meshStandardMaterial color="#888" metalness={0.5} />
      </mesh>
      {/* Bulb */}
      <mesh ref={ref} position={[0, -0.18, 0]}>
        <sphereGeometry args={[0.35, 14, 14]} />
        <meshStandardMaterial color="#ddddaa" emissive="#ffee44" emissiveIntensity={0} roughness={0.3} transparent opacity={0.9} />
      </mesh>
      <pointLight position={[0, -0.18, 0]} color="#fff5cc" intensity={active ? 4.5 : 0} distance={10} />
      {/* Label */}
      <Html position={[0, 1.2, 0]} center distanceFactor={20} zIndexRange={[6,0]}>
        <div style={{
          pointerEvents:'none', fontSize:'8px', fontWeight:700,
          color: active ? '#fef3c7' : '#94a3b8',
          background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:'6px',
          whiteSpace:'nowrap', fontFamily:'system-ui',
        }}>💡 Room 1</div>
      </Html>
    </group>
  );
};

// Room 2 (center): Ceiling Fan
const Room2Fan = ({ active }: { active: boolean }) => {
  const hubRef = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (!hubRef.current) return;
    hubRef.current.rotation.y += active ? dt * 3.5 : 0;
  });
  const bladeAngles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
  return (
    <group position={[0, 7.7, -1]}>
      {/* Drop rod */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial color="#555" metalness={0.7} />
      </mesh>
      {/* Motor housing */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.28, 14]} />
        <meshStandardMaterial color="#888" metalness={0.5} />
      </mesh>
      {/* Spinning hub + blades */}
      <group ref={hubRef} position={[0, -0.05, 0]}>
        {bladeAngles.map((ang, i) => (
          <group key={i} rotation-y={ang}>
            <mesh position={[1.3, 0, 0]}>
              <boxGeometry args={[2.5, 0.06, 0.55]} />
              <meshStandardMaterial color={active ? '#c4a464' : '#8a7050'} roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Light when on */}
      <pointLight position={[0, -0.2, 0]} color="#fff8e0" intensity={active ? 3.5 : 0} distance={9} />
      <Html position={[0, 1.2, 0]} center distanceFactor={20} zIndexRange={[6,0]}>
        <div style={{
          pointerEvents:'none', fontSize:'8px', fontWeight:700,
          color: active ? '#dbeafe' : '#94a3b8',
          background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:'6px',
          whiteSpace:'nowrap', fontFamily:'system-ui',
        }}>🌀 Room 2</div>
      </Html>
    </group>
  );
};

// Room 3 (right): Wall Socket
const Room3Socket = ({ active }: { active: boolean }) => {
  const glowRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = active ? 1.2 + Math.sin(clock.getElapsedTime() * 2) * 0.3 : 0;
  });
  return (
    <group position={[5.8, 2.5, -0.3]}>
      {/* Socket plate */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.7, 0.7]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Left pin hole */}
      <mesh position={[0.05, 0.1, -0.12]}>
        <boxGeometry args={[0.06, 0.12, 0.08]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Right pin hole */}
      <mesh position={[0.05, 0.1, 0.12]}>
        <boxGeometry args={[0.06, 0.12, 0.08]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Earth pin */}
      <mesh position={[0.05, -0.12, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.08]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Active glow */}
      <mesh ref={glowRef} position={[0.06, 0, 0]}>
        <boxGeometry args={[0.04, 0.55, 0.55]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0}
          transparent opacity={0.3} />
      </mesh>
      <pointLight position={[0.3, 0, 0]} color="#aaffbb" intensity={active ? 2.0 : 0} distance={4} />
      <Html position={[0.5, 0.7, 0]} center distanceFactor={18} zIndexRange={[6,0]}>
        <div style={{
          pointerEvents:'none', fontSize:'8px', fontWeight:700,
          color: active ? '#bbf7d0' : '#94a3b8',
          background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:'6px',
          whiteSpace:'nowrap', fontFamily:'system-ui',
        }}>🔌 Room 3</div>
      </Html>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WALL SOCKETS — decorative sockets on room walls
// ─────────────────────────────────────────────────────────────────────────────

const WallSocket = ({ position, active }: { position: [number,number,number]; active: boolean }) => {
  const glowRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      active ? 0.8 + Math.sin(clock.getElapsedTime() * 2.5) * 0.3 : 0;
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.06, 0.28, 0.28]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      <mesh ref={glowRef} position={[0.04, 0, 0]}>
        <boxGeometry args={[0.02, 0.22, 0.22]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FAULT FLASH OVERLAY — short circuit / overload effect in 3D
// ─────────────────────────────────────────────────────────────────────────────

const FaultFlash = ({ type }: { type: 'short' | 'overload' | 'none' }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (type === 'none') { (ref.current.material as THREE.MeshBasicMaterial).opacity = 0; return; }
    const speed = type === 'short' ? 22 : 8;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      Math.max(0, Math.sin(clock.getElapsedTime() * speed) * 0.22);
  });
  return (
    <mesh ref={ref} position={[0, 5, 0]}>
      <boxGeometry args={[30, 20, 30]} />
      <meshBasicMaterial
        color={type === 'short' ? '#ff0000' : '#ff6600'}
        transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE CONTENT
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  connections: string[];
  showExplanation: boolean;
  orbitRef: React.MutableRefObject<any>;
  placedItems: Set<string>;
  buildComplete: boolean;
  wireToolActive: boolean;
  draggingToolId: string | null;
  onSuccessfulConnection: (idx: number) => void;
  onFailedConnection: () => void;
  // New enhanced props
  mainSwitchOn: boolean;
  onSwitchToggle: () => void;
  mcbBreakers: [boolean, boolean, boolean];
  onBreakerToggle: (i: number) => void;
  faultType: 'none' | 'short' | 'overload';
  kwhDisplay: string;
}

const SceneContent = ({
  connections, showExplanation, orbitRef,
  placedItems, buildComplete, wireToolActive, draggingToolId,
  onSuccessfulConnection, onFailedConnection,
  mainSwitchOn, onSwitchToggle,
  mcbBreakers, onBreakerToggle,
  faultType, kwhDisplay,
}: SceneProps) => {
  const step = connections.length;
  const allDone = step >= 3;
  const powerFlowing = allDone && mainSwitchOn && faultType === 'none';

  // Wire drag state
  const [wireDragging, setWireDragging] = useState(false);
  const [wireStartNode, setWireStartNode] = useState<string | null>(null);
  const [wireStartPos, setWireStartPos] = useState<[number,number,number]>([0, 5.5, 0]);
  const [wireDragPos, setWireDragPos] = useState<[number,number,number]>([0, 5.5, 0]);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  // Effects
  const [sparks, setSparks] = useState<{ id: number; pos: [number,number,number] }[]>([]);
  const [ripples, setRipples] = useState<{ id: number; pos: [number,number,number] }[]>([]);
  const [flashLines, setFlashLines] = useState<Set<number>>(new Set());
  const [errorPos, setErrorPos] = useState<[number,number,number] | null>(null);

  const validSource = step < 3 ? CONNECTION_FLOW[step].split('-')[0] : null;
  const validTarget = step < 3 ? CONNECTION_FLOW[step].split('-')[1] : null;

  const startWireDrag = useCallback((nodeId: string) => {
    if (showExplanation || step >= 3 || !wireToolActive) return;
    if (nodeId !== validSource) return;
    const pos = NODE_ATTACH[nodeId];
    setWireStartNode(nodeId);
    setWireStartPos(pos);
    setWireDragPos(pos);
    setWireDragging(true);
    if (orbitRef.current) orbitRef.current.enabled = false;
    document.body.style.cursor = 'crosshair';
  }, [showExplanation, step, wireToolActive, validSource, orbitRef]);

  const handlePointerMove = useCallback((pt: THREE.Vector3) => {
    setWireDragPos([pt.x, pt.y, pt.z]);
    let closest: string | null = null;
    let minDist = 4.0;
    Object.entries(NODE_ATTACH).forEach(([nid, npos]) => {
      if (nid === wireStartNode) return;
      const d = Math.sqrt((pt.x - npos[0])**2 + (pt.z - npos[2])**2);
      if (d < minDist) { minDist = d; closest = nid; }
    });
    setHoverTarget(closest);
  }, [wireStartNode]);

  const handleRelease = useCallback(() => {
    if (!wireDragging) return;
    setWireDragging(false);
    if (orbitRef.current) orbitRef.current.enabled = true;
    document.body.style.cursor = 'default';
    if (hoverTarget) {
      const key = `${wireStartNode}-${hoverTarget}`;
      const expected = CONNECTION_FLOW[step];
      if (key === expected) {
        const targetPos = NODE_ATTACH[hoverTarget];
        setSparks(prev => [...prev, { id: Date.now(), pos: targetPos }]);
        setRipples(prev => [...prev, { id: Date.now(), pos: [targetPos[0], 0, targetPos[2]] }]);
        setFlashLines(prev => new Set([...prev, step]));
        setTimeout(() => setFlashLines(prev => { const s = new Set(prev); s.delete(step); return s; }), 900);
        onSuccessfulConnection(step);
      } else {
        setErrorPos([wireDragPos[0], 0, wireDragPos[2]]);
        setTimeout(() => setErrorPos(null), 700);
        onFailedConnection();
      }
    } else {
      setErrorPos([wireDragPos[0], 0, wireDragPos[2]]);
      setTimeout(() => setErrorPos(null), 500);
    }
    setHoverTarget(null);
    setWireStartNode(null);
  }, [wireDragging, hoverTarget, wireStartNode, step, wireDragPos, orbitRef, onSuccessfulConnection, onFailedConnection]);

  useEffect(() => {
    if (!wireDragging) return;
    const onUp = () => handleRelease();
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleRelease(); };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onEsc); };
  }, [wireDragging, handleRelease]);

  useEffect(() => {
    if (!sparks.length) return;
    const t = setTimeout(() => setSparks(prev => prev.filter(s => Date.now() - s.id < 1500)), 1600);
    return () => clearTimeout(t);
  }, [sparks]);
  useEffect(() => {
    if (!ripples.length) return;
    const t = setTimeout(() => setRipples(prev => prev.filter(r => Date.now() - r.id < 1200)), 1300);
    return () => clearTimeout(t);
  }, [ripples]);

  const dropZones = [
    { id: 'meter',  pos: [-9.0, 0, -1.0] as [number,number,number], label: 'Meter'       },
    { id: 'switch', pos: [-8.0, 0.3, -2.5] as [number,number,number], label: 'Main Switch' },
    { id: 'mcb',    pos: [-7.5, 0.3, -3.6] as [number,number,number], label: 'MCB Panel'  },
  ];

  return (
    <>
      <DragPlane active={wireDragging} onMove={handlePointerMove} onRelease={handleRelease} />

      {/* House geometry */}
      <HouseMeshes />

      {/* Fault flash overlay */}
      <FaultFlash type={faultType} />

      {/* Utility pole + service cable */}
      <UtilityPole serviceActive={step >= 1 || allDone} />

      {/* Drop zones (build phase) */}
      {!buildComplete && dropZones.map(z => (
        <DropZone key={z.id} position={z.pos} label={z.label}
          isHighlighted={draggingToolId === z.id} placed={placedItems.has(z.id)} />
      ))}

      {/* Electric Meter */}
      <ElectricMeter3D
        placed={placedItems.has('meter')}
        isWireSource={wireToolActive && validSource === 'meter' && !wireDragging && !showExplanation}
        isWireTarget={wireDragging && hoverTarget === 'meter'}
        onWireDragStart={() => startWireDrag('meter')}
        powerFlowing={powerFlowing}
        kwhDisplay={kwhDisplay}
      />

      {/* Main Switch */}
      <MainSwitch3D
        placed={placedItems.has('switch')}
        isWireSource={wireToolActive && validSource === 'switch' && !wireDragging && !showExplanation}
        isWireTarget={wireDragging && hoverTarget === 'switch'}
        onWireDragStart={() => startWireDrag('switch')}
        switchOn={mainSwitchOn}
        onToggle={onSwitchToggle}
        wired={step >= 1}
      />

      {/* MCB Panel */}
      <MCBPanel3D
        placed={placedItems.has('mcb')}
        isWireSource={wireToolActive && validSource === 'mcb' && !wireDragging && !showExplanation}
        isWireTarget={wireDragging && hoverTarget === 'mcb'}
        active={step >= 2}
        onWireDragStart={() => startWireDrag('mcb')}
        breakers={mcbBreakers}
        onBreakerToggle={onBreakerToggle}
        wired={step >= 2}
      />

      {/* House endpoint */}
      <HouseEndpoint active={allDone} isWireTarget={wireDragging && hoverTarget === 'house'} />

      {/* Active wire bundles */}
      {step >= 1 && <WireBundle fromId="meter" toId="switch" active flash={flashLines.has(0)} />}
      {step >= 2 && <WireBundle fromId="switch" toId="mcb" active flash={flashLines.has(1)} />}
      {step >= 3 && <WireBundle fromId="mcb" toId="house" active flash={flashLines.has(2)} />}

      {/* Connector joints at each node (when wired) */}
      {step >= 1 && <ConnectorJoint position={NODE_ATTACH['meter']} active={powerFlowing} />}
      {step >= 1 && <ConnectorJoint position={NODE_ATTACH['switch']} active={powerFlowing && mainSwitchOn} />}
      {step >= 2 && <ConnectorJoint position={NODE_ATTACH['mcb']} active={powerFlowing} />}
      {step >= 3 && <ConnectorJoint position={NODE_ATTACH['house']} active={powerFlowing} />}

      {/* Flowing particles — stop if switch off */}
      {step >= 1 && <ElectricParticles fromId="meter" toId="switch" active={powerFlowing || (!allDone && step >= 1)} />}
      {step >= 2 && <ElectricParticles fromId="switch" toId="mcb" active={powerFlowing} />}
      {step >= 3 && <ElectricParticles fromId="mcb" toId="house" active={powerFlowing} />}

      {/* Original ceiling bulbs — all on when power flows */}
      <CeilingBulbs active={powerFlowing} />

      {/* Room appliances — per-MCB controlled */}
      <Room1Bulb active={powerFlowing && mcbBreakers[0]} />
      <Room2Fan active={powerFlowing && mcbBreakers[1]} />
      <Room3Socket active={powerFlowing && mcbBreakers[2]} />

      {/* Wall sockets */}
      <WallSocket position={[-7.7, 1.5, -2.0]} active={powerFlowing && mcbBreakers[0]} />
      <WallSocket position={[-0.2, 1.5, -3.8]} active={powerFlowing && mcbBreakers[1]} />
      <WallSocket position={[7.7, 1.5, -2.0]} active={powerFlowing && mcbBreakers[2]} />

      {/* Wire drag preview */}
      {wireDragging && <DraggableWire start={wireStartPos} end={wireDragPos} />}

      {/* Release tooltip */}
      {wireDragging && hoverTarget === validTarget && (
        <Html position={[NODE_ATTACH[hoverTarget!][0], NODE_ATTACH[hoverTarget!][1]+1.6, NODE_ATTACH[hoverTarget!][2]]} center>
          <div style={{
            pointerEvents:'none', background:'rgba(15,23,42,0.92)', color:'#4ade80',
            padding:'5px 14px', borderRadius:'14px', fontSize:'11px', fontWeight:700,
            whiteSpace:'nowrap', border:'1.5px solid #4ade80', boxShadow:'0 0 12px rgba(74,222,128,0.5)',
          }}>✓ Release to connect!</div>
        </Html>
      )}

      {wireDragging && hoverTarget !== validTarget && (
        <Html position={[wireDragPos[0], wireDragPos[1]+1.5, wireDragPos[2]]} center>
          <div style={{
            pointerEvents:'none', background:'rgba(15,23,42,0.88)', color:'#93c5fd',
            padding:'5px 14px', borderRadius:'14px', fontSize:'11px', fontWeight:700,
            whiteSpace:'nowrap', border:'1.5px solid #60a5fa', boxShadow:'0 0 10px rgba(96,165,250,0.4)',
          }}>
            → Connect to: {validTarget === 'switch' ? 'Main Switch' : validTarget === 'mcb' ? 'MCB Panel' : 'House Circuit'}
          </div>
        </Html>
      )}

      {/* Effects */}
      {sparks.map(s => <SparkBurst key={s.id} position={s.pos} />)}
      {ripples.map(r => <GroundRipple key={r.id} position={r.pos} />)}
      {errorPos && <ErrorRing position={errorPos} />}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOLKIT PANEL (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const ToolkitItem = ({ item, placed, active, locked, onDragStart, onDragEnd, isDraggingThis }: {
  item: typeof TOOLKIT_ITEMS[0]; placed: boolean; active: boolean; locked: boolean;
  onDragStart: () => void; onDragEnd: () => void; isDraggingThis: boolean;
}) => {
  const isWire = item.id === 'wire';
  const disabled = placed && !isWire;
  return (
    <motion.div
      whileHover={!disabled && !locked ? { scale: 1.04, x: 4 } : {}}
      whileTap={!disabled && !locked ? { scale: 0.96 } : {}}
      onPointerDown={(e) => { if (disabled || locked) return; e.preventDefault(); onDragStart(); }}
      onPointerUp={() => { if (!disabled && !locked) onDragEnd(); }}
      style={{
        display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'12px',
        cursor: disabled || locked ? 'not-allowed' : 'grab',
        background: active
          ? 'linear-gradient(135deg,rgba(34,211,238,0.25),rgba(96,165,250,0.2))'
          : placed && !isWire ? 'rgba(30,41,59,0.3)' : item.bg,
        border: active ? '1.5px solid #22d3ee'
          : placed && !isWire ? '1.5px solid rgba(34,197,94,0.4)' : `1.5px solid ${item.color}55`,
        opacity: disabled || locked ? 0.45 : 1,
        transition:'all 0.2s ease', userSelect:'none',
        boxShadow: active ? '0 0 12px rgba(34,211,238,0.35)' : isDraggingThis ? `0 0 16px ${item.color}88` : 'none',
      }}
    >
      <span style={{ fontSize:'20px', lineHeight:1 }}>{item.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'11px', fontWeight:700, color: placed && !isWire ? '#64748b' : '#f1f5f9', lineHeight:1.2 }}>
          {item.label}
        </div>
        <div style={{ fontSize:'10px', color: placed && !isWire ? '#475569' : '#94a3b8', marginTop:'1px' }}>
          {item.sublabel}
        </div>
      </div>
      {placed && !isWire && <span style={{ fontSize:'12px', color:'#22c55e' }}>✓</span>}
      {active && <span style={{ fontSize:'11px', color:'#22d3ee', fontWeight:700 }}>ON</span>}
      {locked && <span style={{ fontSize:'14px' }}>🔒</span>}
    </motion.div>
  );
};

const ToolkitPanel = ({ placedItems, buildComplete, wireToolActive, onToggleWireTool,
  draggingToolId, onItemDragStart, onItemDragEnd, hint }: {
  placedItems: Set<string>; buildComplete: boolean; wireToolActive: boolean;
  onToggleWireTool: () => void; draggingToolId: string | null;
  onItemDragStart: (id: string) => void; onItemDragEnd: (id: string) => void; hint: string;
}) => (
  <div style={{
    position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)',
    zIndex:20, width:'172px', display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'auto',
  }}>
    <div style={{
      background:'rgba(15,23,42,0.90)', backdropFilter:'blur(16px)', borderRadius:'16px', padding:'12px',
      border:'1.5px solid rgba(99,102,241,0.4)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize:'10px', fontWeight:800, letterSpacing:'0.1em', color:'#818cf8', marginBottom:'10px', textAlign:'center' }}>
        🔧 TOOLKIT
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {TOOLKIT_ITEMS.map(item => {
          const isWire = item.id === 'wire';
          const placed = placedItems.has(item.id);
          const active = isWire && wireToolActive;
          const locked = isWire && !buildComplete;
          return (
            <ToolkitItem key={item.id} item={item} placed={placed && !isWire} active={active} locked={locked}
              isDraggingThis={draggingToolId === item.id}
              onDragStart={() => {
                if (isWire) { if (buildComplete) onToggleWireTool(); return; }
                if (!placed) onItemDragStart(item.id);
              }}
              onDragEnd={() => { if (!isWire && !placed) onItemDragEnd(item.id); }}
            />
          );
        })}
      </div>
    </div>

    <motion.div key={hint} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} style={{
      background:'rgba(15,23,42,0.90)', backdropFilter:'blur(12px)', borderRadius:'12px', padding:'10px 11px',
      border:'1.5px solid rgba(99,102,241,0.3)', boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize:'9px', fontWeight:700, color:'#818cf8', marginBottom:'5px', letterSpacing:'0.08em' }}>
        💡 NEXT STEP
      </div>
      <div style={{ fontSize:'10.5px', color:'#cbd5e1', lineHeight:1.5, fontWeight:500 }}>{hint}</div>
    </motion.div>

    <div style={{
      background:'rgba(15,23,42,0.88)', backdropFilter:'blur(10px)', borderRadius:'12px', padding:'10px 11px',
      border:'1.5px solid rgba(99,102,241,0.25)',
    }}>
      <div style={{ fontSize:'9px', fontWeight:700, color:'#818cf8', marginBottom:'6px', letterSpacing:'0.08em' }}>
        🎨 WIRE COLOURS
      </div>
      {[
        { color:'#ef4444', label:'Phase — 240V Live' },
        { color:'#3b82f6', label:'Neutral — Return' },
        { color:'#22c55e', label:'Earth — Safety' },
      ].map(w => (
        <div key={w.label} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:w.color, boxShadow:`0 0 5px ${w.color}`, flexShrink:0 }} />
          <span style={{ fontSize:'9.5px', color:'#cbd5e1' }}>{w.label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DRAG GHOST (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const DragGhost = ({ item, pos }: {
  item: typeof TOOLKIT_ITEMS[0] | null; pos: { x:number; y:number };
}) => {
  if (!item) return null;
  return (
    <motion.div initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:0.92 }} style={{
      position:'fixed', left:pos.x+12, top:pos.y-24, zIndex:9999, pointerEvents:'none',
      background:item.bg, border:`2px solid ${item.color}`, borderRadius:'10px', padding:'6px 12px',
      boxShadow:`0 4px 20px ${item.color}55`, display:'flex', alignItems:'center', gap:'8px',
      backdropFilter:'blur(8px)',
    }}>
      <span style={{ fontSize:'18px' }}>{item.icon}</span>
      <span style={{ fontSize:'11px', fontWeight:700, color:'#f1f5f9', whiteSpace:'nowrap' }}>{item.label}</span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MCB CONTROL PANEL UI — room breaker switches + fault sim
// ─────────────────────────────────────────────────────────────────────────────

interface MCBControlPanelProps {
  mainSwitchOn: boolean;
  onSwitchToggle: () => void;
  mcbBreakers: [boolean, boolean, boolean];
  onBreakerToggle: (i: number) => void;
  faultType: 'none' | 'short' | 'overload';
  onFault: (type: 'short' | 'overload' | 'none') => void;
  freeMode: boolean;
  onFreeModeToggle: () => void;
  wired: boolean;
  kwhDisplay: string;
}

const MCBControlPanel = ({
  mainSwitchOn, onSwitchToggle,
  mcbBreakers, onBreakerToggle,
  faultType, onFault,
  freeMode, onFreeModeToggle,
  wired, kwhDisplay,
}: MCBControlPanelProps) => {
  if (!wired) return null;
  return (
    <motion.div
      initial={{ opacity:0, x:60 }}
      animate={{ opacity:1, x:0 }}
      style={{
        position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
        zIndex:25, width:'200px', display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'auto',
      }}
    >
      {/* Main Switch Control */}
      <div style={{
        background:'rgba(15,23,42,0.92)', backdropFilter:'blur(16px)', borderRadius:'14px', padding:'12px',
        border:`1.5px solid ${mainSwitchOn ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
        boxShadow:`0 4px 20px ${mainSwitchOn ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
      }}>
        <div style={{ fontSize:'9px', fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', marginBottom:'8px' }}>
          ⚡ MAIN SWITCH
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{
            width:40, height:20, borderRadius:'12px', position:'relative',
            background: mainSwitchOn ? '#22c55e' : '#ef4444',
            cursor:'pointer', transition:'background 0.3s',
            boxShadow: mainSwitchOn ? '0 0 10px rgba(34,197,94,0.5)' : '0 0 10px rgba(239,68,68,0.4)',
          }} onClick={onSwitchToggle}>
            <motion.div animate={{ x: mainSwitchOn ? 20 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
              style={{ position:'absolute', top:2, width:16, height:16, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
          </div>
          <span style={{ fontSize:'12px', fontWeight:700, color: mainSwitchOn ? '#22c55e' : '#ef4444' }}>
            {mainSwitchOn ? 'ON' : 'OFF'}
          </span>
        </div>
        <div style={{ fontSize:'9px', color:'#64748b', marginTop:'6px' }}>
          kWh: <span style={{ color:'#fbbf24', fontWeight:700 }}>{kwhDisplay}</span>
        </div>
      </div>

      {/* MCB Breakers */}
      <div style={{
        background:'rgba(15,23,42,0.92)', backdropFilter:'blur(16px)', borderRadius:'14px', padding:'12px',
        border:'1.5px solid rgba(99,102,241,0.35)',
      }}>
        <div style={{ fontSize:'9px', fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', marginBottom:'8px' }}>
          🛡️ MCB BREAKERS
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          {ROOM_LABELS.map((label, i) => {
            const on = mcbBreakers[i];
            const tripped = !on && faultType !== 'none';
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'13px' }}>{ROOM_ICONS[i]}</span>
                <div style={{ flex:1, fontSize:'9.5px', color: on ? '#e2e8f0' : '#64748b', fontWeight:600 }}>
                  {label}
                </div>
                <div
                  onClick={() => onBreakerToggle(i)}
                  style={{
                    width:36, height:18, borderRadius:'10px', position:'relative',
                    background: on ? '#22c55e' : tripped ? '#dc2626' : '#475569',
                    cursor:'pointer', transition:'background 0.25s',
                    boxShadow: on ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                    flexShrink:0,
                  }}
                >
                  <motion.div
                    animate={{ x: on ? 18 : 2 }}
                    transition={{ type:'spring', stiffness:500, damping:30 }}
                    style={{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}
                  />
                </div>
                {tripped && <span style={{ fontSize:'9px', color:'#ef4444' }}>TRIP</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-Wire Logic Status */}
      <div style={{
        background:'rgba(15,23,42,0.90)', backdropFilter:'blur(12px)', borderRadius:'14px', padding:'12px',
        border:'1.5px solid rgba(99,102,241,0.25)',
      }}>
        <div style={{ fontSize:'9px', fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', marginBottom:'8px' }}>
          🔴🔵🟢 WIRE STATUS
        </div>
        {[
          { color:'#ef4444', label:'Phase', status: mainSwitchOn ? '240V Active' : 'Isolated', ok: mainSwitchOn },
          { color:'#3b82f6', label:'Neutral', status: 'Return path OK', ok: true },
          { color:'#22c55e', label:'Earth', status: 'Safety grounded', ok: true },
        ].map(w => (
          <div key={w.label} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: w.ok ? w.color : '#4a5568',
              boxShadow: w.ok ? `0 0 5px ${w.color}` : 'none', flexShrink:0 }} />
            <span style={{ fontSize:'9px', color:'#94a3b8', flex:1 }}>{w.label}</span>
            <span style={{ fontSize:'8px', color: w.ok ? '#86efac' : '#fca5a5', fontWeight:600 }}>{w.status}</span>
          </div>
        ))}
      </div>

      {/* Fault Simulation */}
      <div style={{
        background:'rgba(15,23,42,0.90)', backdropFilter:'blur(12px)', borderRadius:'14px', padding:'12px',
        border:`1.5px solid ${faultType !== 'none' ? 'rgba(239,68,68,0.6)' : 'rgba(99,102,241,0.25)'}`,
        boxShadow: faultType !== 'none' ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
      }}>
        <div style={{ fontSize:'9px', fontWeight:800, color: faultType !== 'none' ? '#fca5a5' : '#94a3b8', letterSpacing:'0.08em', marginBottom:'8px' }}>
          ⚠️ FAULT SIMULATOR
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {([
            { type:'short' as const,    icon:'⚡', label:'Short Circuit', color:'#ef4444' },
            { type:'overload' as const, icon:'🔥', label:'Overload Trip',  color:'#f59e0b' },
            { type:'none' as const,     icon:'✅', label:'Reset Circuit',  color:'#22c55e' },
          ] as const).map(f => (
            <button key={f.type} onClick={() => onFault(f.type)} style={{
              display:'flex', alignItems:'center', gap:'7px', padding:'5px 8px', borderRadius:'8px',
              background: faultType === f.type && f.type !== 'none'
                ? `${f.color}22`
                : 'rgba(30,41,59,0.5)',
              border:`1px solid ${faultType === f.type && f.type !== 'none' ? f.color : 'rgba(71,85,105,0.5)'}`,
              cursor:'pointer', fontSize:'9.5px', color: f.type === 'none' ? '#86efac' : '#e2e8f0',
              fontWeight:600, transition:'all 0.2s',
            }}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Free Mode */}
      <motion.button
        whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
        onClick={onFreeModeToggle}
        style={{
          padding:'8px 14px', borderRadius:'12px', fontWeight:700, fontSize:'10.5px',
          background: freeMode
            ? 'linear-gradient(135deg,#7c3aed,#a855f7)'
            : 'rgba(15,23,42,0.88)',
          color: freeMode ? '#fff' : '#a78bfa',
          border:`1.5px solid ${freeMode ? '#a855f7' : 'rgba(167,139,250,0.35)'}`,
          cursor:'pointer', letterSpacing:'0.03em',
          boxShadow: freeMode ? '0 0 18px rgba(168,85,247,0.4)' : 'none',
        }}
      >
        🎮 {freeMode ? 'Free Mode: ON' : 'Enable Free Mode'}
      </motion.button>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART FEEDBACK BANNER
// ─────────────────────────────────────────────────────────────────────────────

const SmartFeedbackBanner = ({ message, type }: {
  message: string | null; type: 'info' | 'warning' | 'error' | 'success';
}) => {
  if (!message) return null;
  const colors = {
    info:    { bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.5)', text:'#93c5fd' },
    warning: { bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.5)', text:'#fcd34d' },
    error:   { bg:'rgba(239,68,68,0.15)',  border:'rgba(239,68,68,0.5)',  text:'#fca5a5' },
    success: { bg:'rgba(34,197,94,0.15)',  border:'rgba(34,197,94,0.5)',  text:'#86efac' },
  }[type];
  return (
    <motion.div
      initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
      style={{
        position:'absolute', top:'12px', left:'50%', transform:'translateX(-50%)',
        zIndex:30, pointerEvents:'none',
        background: colors.bg, border:`1.5px solid ${colors.border}`,
        borderRadius:'12px', padding:'8px 18px',
        backdropFilter:'blur(12px)',
        boxShadow:`0 4px 20px rgba(0,0,0,0.3)`,
        maxWidth:'440px', textAlign:'center',
      }}
    >
      <span style={{ fontSize:'11px', fontWeight:700, color: colors.text, fontFamily:'system-ui' }}>
        {message}
      </span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const Level5House = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();

  // Original state
  const [connections, setConnections] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [placedItems, setPlacedItems] = useState<Set<string>>(new Set());
  const [buildComplete, setBuildComplete] = useState(false);
  const [wireToolActive, setWireToolActive] = useState(false);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x:0, y:0 });

  // NEW enhanced state
  const [mainSwitchOn, setMainSwitchOn] = useState(true);
  const [mcbBreakers, setMcbBreakers] = useState<[boolean, boolean, boolean]>([true, true, true]);
  const [faultType, setFaultType] = useState<'none' | 'short' | 'overload'>('none');
  const [freeMode, setFreeMode] = useState(false);
  const [smartFeedback, setSmartFeedback] = useState<{ msg: string; type: 'info'|'warning'|'error'|'success' } | null>(null);
  const [kwhValue, setKwhValue] = useState(0);

  const orbitRef = useRef<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allDone = step >= 3;
  const powerFlowing = allDone && mainSwitchOn && faultType === 'none';
  const kwhDisplay = kwhValue.toFixed(2);

  // kWh accumulation while power is flowing
  useEffect(() => {
    if (!powerFlowing) return;
    const interval = setInterval(() => {
      setKwhValue(prev => parseFloat((prev + 0.001).toFixed(3)));
    }, 300);
    return () => clearInterval(interval);
  }, [powerFlowing]);

  // Smart feedback helper
  const showSmartFeedback = useCallback((msg: string, type: 'info'|'warning'|'error'|'success', duration = 3500) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setSmartFeedback({ msg, type });
    feedbackTimerRef.current = setTimeout(() => setSmartFeedback(null), duration);
  }, []);

  useEffect(() => {
    setVoltMessage('🔧 Drag the electrical components from the toolkit into the house to build the wiring system!');
  }, []);

  useEffect(() => {
    if (REQUIRED_ITEMS.every(id => placedItems.has(id))) {
      setBuildComplete(true);
      setVoltMessage('✅ All components placed! Click the 〰️ Wire Tool then drag wires between components!');
    }
  }, [placedItems]);

  // React to fault changes
  useEffect(() => {
    if (faultType === 'short') {
      setMcbBreakers([false, false, false]);
      showSmartFeedback('⚡ SHORT CIRCUIT detected! All MCBs tripped — circuit isolated for safety.', 'error', 5000);
      setVoltMessage('⚡ SHORT CIRCUIT! MCBs tripped in 0.01s — reset each breaker to restore power.');
    } else if (faultType === 'overload') {
      // Overload: trip breakers one by one
      setTimeout(() => setMcbBreakers(prev => [false, prev[1], prev[2]]), 800);
      setTimeout(() => setMcbBreakers(prev => [prev[0], false, prev[2]]), 1400);
      setTimeout(() => setMcbBreakers(prev => [prev[0], prev[1], false]), 2000);
      showSmartFeedback('🔥 OVERLOAD — MCB tripping in sequence! Reset each breaker manually.', 'warning', 5000);
      setVoltMessage('🔥 OVERLOAD detected! Circuit drawing too much current — MCBs protecting the system!');
    } else if (faultType === 'none') {
      showSmartFeedback('✅ Circuit reset! All systems normal.', 'success', 2500);
    }
  }, [faultType]);

  // React to switch toggle
  useEffect(() => {
    if (!allDone) return;
    if (!mainSwitchOn) {
      showSmartFeedback('⚫ Main Switch OFF — Neutral missing from downstream circuit. Power isolated.', 'warning');
      setVoltMessage('⚫ Main Switch OFF! Phase isolated — safe to work on circuits now.');
    } else {
      showSmartFeedback('🔴 Main Switch ON — Phase (240V) flowing through all three wires.', 'success');
      setVoltMessage('🔴 Main Switch ON! Phase + Neutral + Earth all active — house powered.');
    }
  }, [mainSwitchOn, allDone]);

  // React to breaker toggles
  const handleBreakerToggle = useCallback((i: number) => {
    setMcbBreakers(prev => {
      const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean];
      next[i] = !next[i];
      const label = ROOM_LABELS[i];
      const on = !prev[i];
      showSmartFeedback(
        on
          ? `✅ MCB ${i+1} ON — ${label} circuit energised.`
          : `⚫ MCB ${i+1} OFF — ${label} isolated.`,
        on ? 'success' : 'info',
      );
      setVoltMessage(on
        ? `✅ Breaker ${i+1} ON! Power flows to ${label}.`
        : `⚫ Breaker ${i+1} OFF. ${label} safely isolated.`);
      return next;
    });
  }, [showSmartFeedback, setVoltMessage]);

  const handleSwitchToggle = useCallback(() => {
    if (!allDone) return;
    setMainSwitchOn(prev => !prev);
  }, [allDone]);

  const handleFault = useCallback((type: 'short' | 'overload' | 'none') => {
    setFaultType(type);
    if (type === 'none') {
      setMcbBreakers([true, true, true]);
    }
  }, []);

  const handleSuccessfulConnection = useCallback((idx: number) => {
    const key = CONNECTION_FLOW[idx];
    const newConns = [...connections, key];
    setConnections(newConns);
    setStep(newConns.length);
    setShowExplanation(true);
    addScore(60);

    if (idx === 0) setVoltMessage('✅ Meter → Main Switch! Phase (Red) + Neutral (Blue) + Earth (Green) wires connected safely!');
    if (idx === 1) setVoltMessage('✅ Switch → MCB! Power now enters the distribution board — each room gets its own breaker!');
    if (idx === 2) {
      setVoltMessage('⭐ All connections made! The house is FULLY wired — lights on!');
      showSmartFeedback('🏠 House fully wired! Use the control panel to manage switches, breakers & simulate faults.', 'success', 6000);
      setTimeout(() => {
        setLevelComplete(true);
        addStar();
        addScore(100);
      }, 1200);
    }
  }, [connections, setLevelComplete, addScore, addStar, setVoltMessage, showSmartFeedback]);

  const handleFailedConnection = useCallback(() => {
    setVoltMessage('❌ Wrong connection! Follow the flow: Meter → Main Switch → MCB Panel → House');
    showSmartFeedback('❌ Incorrect connection — follow the circuit flow: Meter → Switch → MCB → House', 'error');
  }, [setVoltMessage, showSmartFeedback]);

  const handleContinue = () => setShowExplanation(false);

  // Toolkit drag
  const handleItemDragStart = useCallback((id: string) => {
    setDraggingToolId(id);
    document.body.style.cursor = 'grabbing';
  }, []);
  const handleItemDragEnd = useCallback((_id: string) => {
    setDraggingToolId(null);
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (draggingToolId) setGhostPos({ x:e.clientX, y:e.clientY }); };
    const onUp = (e: PointerEvent) => {
      if (!draggingToolId) return;
      const toolId = draggingToolId;
      setDraggingToolId(null);
      document.body.style.cursor = 'default';
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        setPlacedItems(prev => { const n = new Set(prev); n.add(toolId); return n; });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [draggingToolId]);

  const toggleWireTool = () => {
    setWireToolActive(prev => {
      const next = !prev;
      setVoltMessage(next
        ? '〰️ Wire Tool ON! Click the glowing ◉ node then drag to the next component!'
        : 'Wire tool off. Click it again to re-enable.');
      return next;
    });
  };

  const hint = useMemo(() => {
    if (!buildComplete) {
      const rem = REQUIRED_ITEMS.filter(id => !placedItems.has(id));
      if (rem.length === REQUIRED_ITEMS.length) return 'Drag components from here into the scene!';
      const labels: Record<string,string> = { meter:'Meter', switch:'Main Switch', mcb:'MCB Panel' };
      if (rem.length > 0) return `Still need: ${rem.map(id => labels[id]).join(', ')}`;
    }
    if (!wireToolActive) return 'All placed! Click the 〰️ Wire Tool to start wiring!';
    if (step === 0) return 'Click the cyan ◉ on the Meter and drag to the Main Switch!';
    if (step === 1) return 'Click the cyan ◉ on the Main Switch and drag to the MCB Panel!';
    if (step === 2) return 'Last wire! Click the MCB ◉ and drag to the House Circuit!';
    return freeMode ? '🎮 Free Mode! Experiment with switches & faults!' : '⚡ House fully wired! Use the control panel →';
  }, [buildComplete, placedItems, wireToolActive, step, freeMode]);

  const explanationStep = Math.min(step - 1, STEP_EXPLANATIONS.length - 1);
  const currentExplanation = STEP_EXPLANATIONS[Math.max(0, explanationStep)];
  const ghostItem = draggingToolId ? TOOLKIT_ITEMS.find(i => i.id === draggingToolId) ?? null : null;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(180deg,#d0eaf8 0%,#c8dff0 50%,#b8d0e8 100%)' }} />

      {/* 3-D Canvas */}
      <div ref={canvasRef} className="absolute inset-0">
        <Canvas style={{ width:'100%', height:'100%' }} camera={{ position:[0, 10, 24], fov:52 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[8, 14, 8]} intensity={1.1} castShadow />
          <pointLight position={[0, 10, 0]} color="#fff5cc" intensity={powerFlowing ? 4 : 0} distance={30} />
          <OrbitControls ref={orbitRef} enablePan={false} minDistance={6} maxDistance={38}
            maxPolarAngle={Math.PI / 2.15} target={[0, 4, 0]} />
          <SceneContent
            connections={connections} showExplanation={showExplanation} orbitRef={orbitRef}
            placedItems={placedItems} buildComplete={buildComplete}
            wireToolActive={wireToolActive} draggingToolId={draggingToolId}
            onSuccessfulConnection={handleSuccessfulConnection}
            onFailedConnection={handleFailedConnection}
            mainSwitchOn={mainSwitchOn} onSwitchToggle={handleSwitchToggle}
            mcbBreakers={mcbBreakers} onBreakerToggle={handleBreakerToggle}
            faultType={faultType} kwhDisplay={kwhDisplay}
          />
        </Canvas>
      </div>

      <DragGhost item={ghostItem} pos={ghostPos} />

      {/* Smart Feedback Banner */}
      <AnimatePresence>
        {smartFeedback && (
          <SmartFeedbackBanner key={smartFeedback.msg} message={smartFeedback.msg} type={smartFeedback.type} />
        )}
      </AnimatePresence>

      {/* Fault warning badge */}
      <AnimatePresence>
        {faultType !== 'none' && (
          <motion.div
            initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            style={{
              position:'absolute', top:'12px', right:'220px', zIndex:35,
              background:'rgba(239,68,68,0.2)', border:'1.5px solid #ef4444',
              borderRadius:'10px', padding:'6px 14px',
              backdropFilter:'blur(12px)', pointerEvents:'none',
            }}
          >
            <motion.span
              animate={{ opacity:[1, 0.4, 1] }} transition={{ duration:0.5, repeat:Infinity }}
              style={{ fontSize:'11px', fontWeight:800, color:'#fca5a5', fontFamily:'system-ui' }}
            >
              {faultType === 'short' ? '⚡ SHORT CIRCUIT' : '🔥 OVERLOAD'} — MCBs TRIPPED
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <ToolkitPanel
        placedItems={placedItems} buildComplete={buildComplete}
        wireToolActive={wireToolActive} onToggleWireTool={toggleWireTool}
        draggingToolId={draggingToolId}
        onItemDragStart={handleItemDragStart} onItemDragEnd={handleItemDragEnd}
        hint={hint}
      />

      {/* MCB Control Panel (right side, appears after wiring) */}
      <MCBControlPanel
        mainSwitchOn={mainSwitchOn} onSwitchToggle={handleSwitchToggle}
        mcbBreakers={mcbBreakers} onBreakerToggle={handleBreakerToggle}
        faultType={faultType} onFault={handleFault}
        freeMode={freeMode} onFreeModeToggle={() => setFreeMode(prev => !prev)}
        wired={allDone} kwhDisplay={kwhDisplay}
      />

      {/* Explanation popup (unchanged) */}
      <AnimatePresence>
        {showExplanation && step > 0 && step <= 3 && (
          <motion.div
            initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ background:'rgba(0,0,0,0.18)' }}
          >
            <motion.div
              initial={{ y:30 }} animate={{ y:0 }}
              className="flex flex-col items-center gap-4 px-8 py-7 rounded-3xl"
              style={{
                background:'rgba(255,255,255,0.97)', boxShadow:'0 8px 40px rgba(0,0,0,0.20)',
                border:'3px solid #fbbf24', maxWidth:440, width:'90%',
              }}
            >
              <div className={`w-full px-4 py-3 rounded-2xl bg-gradient-to-r ${currentExplanation.color} text-white text-center font-display font-bold`}
                style={{ fontSize:'1.05rem' }}>
                {currentExplanation.icon} {currentExplanation.title}
              </div>
              <p className="text-slate-700 leading-relaxed text-center" style={{ fontSize:'0.92rem' }}>
                {currentExplanation.info}
              </p>
              <div className="px-4 py-2.5 rounded-xl w-full text-center"
                style={{ background:'#fefce8', border:'1.5px solid #fde047' }}>
                <p className="font-bold text-amber-700" style={{ fontSize:'1rem' }}>
                  {currentExplanation.formula}
                </p>
                <p style={{ fontSize:'0.78rem', color:'#92400e' }}>{currentExplanation.formulaNote}</p>
              </div>
              <motion.button
                whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}
                onClick={handleContinue}
                className="px-8 py-3 rounded-2xl font-display font-bold text-white"
                style={{ background:'linear-gradient(135deg,#f59e0b,#fbbf24)', fontSize:'1rem',
                  boxShadow:'0 4px 16px rgba(245,158,11,0.4)' }}
              >
                {step < 3 ? 'Continue Wiring →' : '🏠 House Powered!'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
