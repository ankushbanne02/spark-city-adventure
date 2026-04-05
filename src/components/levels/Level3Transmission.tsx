import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TOWER_POSITIONS: [number, number, number][] = [
  [-8, 0, 0],
  [0, 0, 0],
  [8, 0, 0],
];

/** Wire attachment heights for each node */
const NODE_ATTACH: Record<string, [number, number, number]> = {
  transformer: [-15, 8.5, 0],
  tower1:      [-8,  8.5, 0],
  tower2:      [0,   8.5, 0],
  tower3:      [8,   8.5, 0],
};

/** The required order of connections */
const CONNECTION_FLOW = ['transformer-tower1', 'tower1-tower2', 'tower2-tower3'] as const;

const TOOLKIT_ITEMS = [
  { id: 'transformer', label: 'Step-Up Transformer', sublabel: '132 kV',      icon: '⚡', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  { id: 'tower1',      label: 'Tower 1',             sublabel: 'Transmission', icon: '🗼', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { id: 'tower2',      label: 'Tower 2',             sublabel: 'Transmission', icon: '🗼', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { id: 'tower3',      label: 'Tower 3',             sublabel: 'Transmission', icon: '🗼', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { id: 'substation',  label: 'Substation',          sublabel: 'Step-Down',    icon: '🏭', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
  { id: 'wire',        label: 'Power Line',          sublabel: 'Wire Tool',    icon: '〰️', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
];

const REQUIRED_ITEMS = ['transformer', 'tower1', 'tower2', 'tower3', 'substation'];

const STEP_EXPLANATIONS = [
  {
    title: 'Transformer → Tower 1 Connected!',
    icon: '⚡',
    color: 'from-amber-600 to-amber-400',
    info: 'Great wiring! Electricity is stepped UP to 132,000 Volts (132 kV) by the transformer. High voltage = LOW current = far less heat wasted in the wires!',
    formula: 'P_loss = I² × R',
    formulaNote: 'Lower current = much less power loss!',
  },
  {
    title: 'Tower 1 → Tower 2 Connected!',
    icon: '🗼',
    color: 'from-orange-600 to-amber-500',
    info: 'Excellent! Electricity travels at near the speed of light through these wires. Transmission towers can be 50–100 m tall and carry power thousands of kilometres!',
    formula: 'V₁/V₂ = N₁/N₂',
    formulaNote: 'Transformer turns ratio controls voltage.',
  },
  {
    title: 'Tower 2 → Tower 3 Connected!',
    icon: '🗼',
    color: 'from-yellow-600 to-amber-400',
    info: 'Almost there! High-voltage lines carry electricity from power plants, over mountains and rivers, all the way to cities and towns!',
    formula: '132 kV',
    formulaNote: 'High-tension lines carry this voltage.',
  },
  {
    title: 'Network Complete! ⚡',
    icon: '✅',
    color: 'from-green-600 to-emerald-500',
    info: 'Excellent! All 3 towers are connected. 132,000 Volts of electricity is flowing to Spark City! Next stop: the Substation, where voltage steps DOWN to safe levels.',
    formula: 'Dam → Transformer → Towers → Substation',
    formulaNote: 'Electricity journey continues!',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL COMPONENTS (3-D)
// ─────────────────────────────────────────────────────────────────────────────

const PowerLine = ({ start, end, active, flash = false }: {
  start: [number, number, number]; end: [number, number, number];
  active: boolean; flash?: boolean;
}) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3((start[0]+end[0])/2, Math.min(start[1],end[1])-1.5, (start[2]+end[2])/2),
    new THREE.Vector3(...end),
  ]), [start, end]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = flash
      ? 0.5 + Math.sin(clock.getElapsedTime() * 18) * 0.5
      : active ? 0.55 + Math.sin(clock.getElapsedTime() * 2) * 0.15 : 0;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.09, 8, false]} />
      <meshStandardMaterial ref={matRef} color={active ? '#f59e0b' : '#888888'}
        emissive={active ? '#f59e0b' : '#000000'} emissiveIntensity={active ? 0.7 : 0}
        metalness={0.3} roughness={0.5} />
    </mesh>
  );
};

const ElectricParticles = ({ start, end, active, speed = 0.45 }: {
  start: [number, number, number]; end: [number, number, number]; active: boolean; speed?: number;
}) => {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 35;
  const posRef = useRef(new Float32Array(COUNT * 3));
  const tRef = useRef<number[]>([]);
  useEffect(() => { tRef.current = Array.from({ length: COUNT }, () => Math.random()); }, []);
  useFrame((_, dt) => {
    if (!active || !ref.current) return;
    const arr = posRef.current; const ts = tRef.current;
    const mid = [(start[0]+end[0])/2, Math.min(start[1],end[1])-1.5, (start[2]+end[2])/2];
    for (let i = 0; i < COUNT; i++) {
      ts[i] = (ts[i] + dt * speed) % 1; const t = ts[i];
      arr[i*3]   = (1-t)*(1-t)*start[0] + 2*(1-t)*t*mid[0] + t*t*end[0];
      arr[i*3+1] = (1-t)*(1-t)*start[1] + 2*(1-t)*t*mid[1] + t*t*end[1];
      arr[i*3+2] = (1-t)*(1-t)*start[2] + 2*(1-t)*t*mid[2] + t*t*end[2];
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#fbbf24" size={0.35} transparent opacity={active ? 1 : 0} />
    </points>
  );
};

const Label3D = ({ position, text, active, yOffset = 0 }: {
  position: [number, number, number]; text: string; active: boolean; yOffset?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = position[1] + yOffset + Math.sin(clock.getElapsedTime() * 1.4) * 0.25;
  });
  return (
    <group ref={groupRef} position={[position[0], position[1] + yOffset, position[2]]}>
      <Html center distanceFactor={28} zIndexRange={[10, 0]}>
        <div style={{
          pointerEvents: 'none', whiteSpace: 'nowrap', padding: '4px 12px', borderRadius: '20px',
          fontSize: '11px', fontWeight: 700, fontFamily: 'system-ui, sans-serif',
          background: active ? 'linear-gradient(135deg,rgba(245,158,11,0.95),rgba(251,191,36,0.95))' : 'rgba(30,41,59,0.82)',
          color: active ? '#1c1917' : '#cbd5e1',
          border: active ? '1.5px solid #fbbf24' : '1.5px solid rgba(100,116,139,0.5)',
          boxShadow: active ? '0 0 12px rgba(251,191,36,0.6),0 2px 8px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.25)',
          transition: 'all 0.3s ease',
        }}>{text}</div>
      </Html>
    </group>
  );
};

const PulsingRing = ({ position, color = '#fbbf24' }: { position: [number,number,number]; color?: string }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    ref.current.scale.set(s, 1, s);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = 0.55 - Math.sin(clock.getElapsedTime() * 3) * 0.25;
  });
  return (
    <mesh ref={ref} position={[position[0], position[1]+0.08, position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[1.8, 2.5, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
};

/** Glowing halo on a node to indicate it's a valid wire source */
const SourceHalo = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.25;
    ref.current.scale.setScalar(s);
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 4) * 0.6;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.55, 16, 16]} />
      <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} transparent opacity={0.85} />
    </mesh>
  );
};

const SparkBurst = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 22;
  const posArr = useMemo(() => new Float32Array(COUNT * 3), []);
  const velRef = useRef<[number,number,number][]>([]);
  const lifeRef = useRef(0);
  useEffect(() => {
    velRef.current = Array.from({length: COUNT}, () => [
      (Math.random()-0.5)*7, Math.random()*5+1, (Math.random()-0.5)*7,
    ] as [number,number,number]);
    lifeRef.current = 0;
    for (let i = 0; i < COUNT; i++) { posArr[i*3]=position[0]; posArr[i*3+1]=position[1]; posArr[i*3+2]=position[2]; }
  }, [position, posArr]);
  useFrame((_, dt) => {
    if (!ref.current || lifeRef.current > 1.2) return;
    lifeRef.current += dt;
    velRef.current.forEach(([vx, vy, vz], i) => {
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
      <pointsMaterial color="#ffd700" size={0.45} transparent opacity={1} depthWrite={false} />
    </points>
  );
};

const GroundRipple = ({ position }: { position: [number,number,number] }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const life = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current += dt;
    ref.current.scale.set(1 + life.current*4, 1, 1 + life.current*4);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - life.current*0.8);
  });
  return (
    <mesh ref={ref} position={[position[0],0.05,position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.5, 1.2, 32]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.6} depthWrite={false} />
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
    <mesh ref={ref} position={[position[0],0.1,position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[2, 3.2, 32]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
};

const DraggableWire = ({ start, end }: { start: [number,number,number]; end: [number,number,number] }) => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3((start[0]+end[0])/2, Math.min(start[1],end[1])-1, (start[2]+end[2])/2),
    new THREE.Vector3(...end),
  ]), [start, end]);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 0.4 + Math.sin(clock.getElapsedTime()*10)*0.3;
  });
  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.08, 8, false]} />
      <meshStandardMaterial ref={matRef} color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5}
        transparent opacity={0.88} metalness={0.2} roughness={0.4} />
    </mesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOWER
// ─────────────────────────────────────────────────────────────────────────────

const Tower = ({ position, active, isWireSource, isWireTarget, isDragging, placed, onWireDragStart }: {
  position: [number,number,number]; active: boolean;
  isWireSource: boolean; isWireTarget: boolean; isDragging: boolean;
  placed: boolean; onWireDragStart: () => void;
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (placed && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt * 4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });

  if (!placed) return null;
  const highlight = isWireTarget || (hovered && !isDragging && isWireSource);

  return (
    <group ref={groupRef} position={position}
      onPointerDown={(e) => {
        if (isWireSource) { e.stopPropagation(); onWireDragStart(); }
      }}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = isWireSource ? 'crosshair' : 'default';
      }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {isWireSource && <PulsingRing position={[0,0,0]} color="#22d3ee" />}
      {isWireTarget && <PulsingRing position={[0,0,0]} color="#4ade80" />}

      <mesh position={[0,5,0]} castShadow>
        <boxGeometry args={[0.5,10,0.5]} />
        <meshStandardMaterial color={active ? '#888888' : highlight ? '#a3b4c8' : '#777777'}
          emissive={isWireTarget ? '#4ade80' : isWireSource && hovered ? '#22d3ee' : '#000000'}
          emissiveIntensity={highlight ? 0.4 : 0} metalness={0.6} roughness={0.4} />
      </mesh>
      {[7, 8.5].map((y, i) => (
        <mesh key={i} position={[0,y,0]} castShadow>
          <boxGeometry args={[5-i*1.5,0.2,0.2]} />
          <meshStandardMaterial color={active ? '#999999' : highlight ? '#a3b4c8' : '#777777'}
            emissive={highlight ? '#22d3ee' : '#000'} emissiveIntensity={highlight ? 0.25 : 0} metalness={0.5} />
        </mesh>
      ))}
      {[-2,2,-1,1].map((x, i) => (
        <mesh key={i} position={[x, i<2?7:8.5, 0]}>
          <cylinderGeometry args={[0.18,0.18,0.5,12]} />
          <meshStandardMaterial
            color={active ? '#f59e0b' : highlight ? '#86efac' : '#aaaaaa'}
            emissive={active ? '#f59e0b' : highlight ? '#4ade80' : '#000000'}
            emissiveIntensity={active ? 0.6 : highlight ? 0.5 : 0} />
        </mesh>
      ))}
      {isWireTarget && (
        <mesh position={[0,11.5,0]}>
          <sphereGeometry args={[0.65,16,16]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2.5} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMER
// ─────────────────────────────────────────────────────────────────────────────

const Transformer = ({ energized, placed, isWireSource, onWireDragStart }: {
  energized: boolean; placed: boolean; isWireSource: boolean; onWireDragStart: () => void;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      energized ? 0.25 + Math.sin(clock.getElapsedTime()*4)*0.15 : 0;
    if (placed && groupRef.current && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt*4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });

  if (!placed) return null;
  return (
    <group ref={groupRef} position={[-15,0,0]}
      onPointerDown={(e) => { if (isWireSource) { e.stopPropagation(); onWireDragStart(); } }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = isWireSource ? 'crosshair' : 'default'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {isWireSource && <PulsingRing position={[0,0,0]} color="#22d3ee" />}
      <mesh ref={ref} position={[0,2,0]} castShadow>
        <boxGeometry args={[3.5,4,3.5]} />
        <meshStandardMaterial color="#6b7280"
          emissive={isWireSource && hovered ? '#22d3ee' : '#f59e0b'}
          emissiveIntensity={0} metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.8,0,0.8].map((x,i) => (
        <mesh key={i} position={[x,4.3,0]}>
          <cylinderGeometry args={[0.18,0.18,0.9,12]} />
          <meshStandardMaterial color={energized ? '#f59e0b' : '#aa5555'}
            emissive={energized ? '#f59e0b' : '#000'} emissiveIntensity={energized ? 0.8 : 0} />
        </mesh>
      ))}
      <mesh position={[0,-0.05,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[4,4]} />
        <meshStandardMaterial color="#aaaaaa" />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSTATION
// ─────────────────────────────────────────────────────────────────────────────

const Substation3D = ({ active, placed }: { active: boolean; placed: boolean }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(0);
  useFrame((_, dt) => {
    if (placed && groupRef.current && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + dt*4);
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });
  if (!placed) return null;
  return (
    <group ref={groupRef} position={[14,0,0]}>
      {[0,2,-2].map((x,i) => (
        <mesh key={i} position={[x,2+i,0]} castShadow>
          <boxGeometry args={[1.5,4+i*2,1.5]} />
          <meshStandardMaterial color={active ? '#fbbf24' : '#9ca3af'}
            emissive={active ? '#fbbf24' : '#000'} emissiveIntensity={active ? 0.4 : 0} />
        </mesh>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DROP ZONES (build phase)
// ─────────────────────────────────────────────────────────────────────────────

const DropZone = ({ position, label, isHighlighted, placed }: {
  position: [number,number,number]; label: string; isHighlighted: boolean; placed: boolean;
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = placed ? 0
      : isHighlighted ? 0.5 + Math.sin(clock.getElapsedTime()*4)*0.3
      : 0.2 + Math.sin(clock.getElapsedTime()*2)*0.1;
  });
  if (placed) return null;
  return (
    <group position={position}>
      <mesh ref={ref} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[1.5,3,32]} />
        <meshBasicMaterial color={isHighlighted ? '#60a5fa' : '#94a3b8'} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={25} zIndexRange={[5,0]}>
        <div style={{
          pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: '10px', fontWeight: 700,
          color: isHighlighted ? '#93c5fd' : '#94a3b8', fontFamily: 'system-ui, sans-serif',
          background: 'rgba(15,23,42,0.75)', padding: '3px 9px', borderRadius: '12px',
          border: `1px dashed ${isHighlighted ? '#60a5fa' : '#475569'}`,
          boxShadow: isHighlighted ? '0 0 8px rgba(96,165,250,0.4)' : 'none',
        }}>Drop {label} here</div>
      </Html>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAG PLANE (wire dragging — invisible plane at y=8)
// ─────────────────────────────────────────────────────────────────────────────

const DragPlane = ({ active, onMove, onRelease }: {
  active: boolean; onMove: (pt: THREE.Vector3) => void; onRelease: () => void;
}) => {
  if (!active) return null;
  return (
    <mesh position={[0,8.5,0]} rotation={[-Math.PI/2,0,0]}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.point); }}
      onPointerUp={(e) => { e.stopPropagation(); onRelease(); }}>
      <planeGeometry args={[120,120]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
  onSuccessfulConnection: (connectionIndex: number) => void;
  onFailedConnection: () => void;
}

const SceneContent = ({
  connections, showExplanation, orbitRef,
  placedItems, buildComplete, wireToolActive, draggingToolId,
  onSuccessfulConnection, onFailedConnection,
}: SceneProps) => {
  const step = connections.length;

  // ── Wire drag state ──
  const [wireDragging, setWireDragging] = useState(false);
  const [wireStartNode, setWireStartNode] = useState<string | null>(null);
  const [wireStartPos, setWireStartPos] = useState<[number,number,number]>([0,8.5,0]);
  const [wireDragPos, setWireDragPos] = useState<[number,number,number]>([0,8.5,0]);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  // ── Effect containers ──
  const [sparks, setSparks] = useState<{id: number; pos: [number,number,number]}[]>([]);
  const [ripples, setRipples] = useState<{id: number; pos: [number,number,number]}[]>([]);
  const [flashLines, setFlashLines] = useState<Set<number>>(new Set());
  const [errorPos, setErrorPos] = useState<[number,number,number] | null>(null);

  // Derived: which node is valid source / target for next connection
  const validSource = step < 3 ? CONNECTION_FLOW[step].split('-')[0] : null;
  const validTarget = step < 3 ? CONNECTION_FLOW[step].split('-')[1] : null;

  const startWireDrag = useCallback((nodeId: string) => {
    if (showExplanation || step >= 3 || !wireToolActive) return;
    if (nodeId !== validSource) return;
    setWireStartNode(nodeId);
    const pos = NODE_ATTACH[nodeId];
    setWireStartPos(pos);
    setWireDragPos(pos);
    setWireDragging(true);
    if (orbitRef.current) orbitRef.current.enabled = false;
    document.body.style.cursor = 'crosshair';
  }, [showExplanation, step, wireToolActive, validSource, orbitRef]);

  const handlePointerMove = useCallback((pt: THREE.Vector3) => {
    setWireDragPos([pt.x, pt.y, pt.z]);
    // Proximity detection to all nodes
    let closest: string | null = null;
    let minDist = 4.5;
    Object.entries(NODE_ATTACH).forEach(([nid, npos]) => {
      if (nid === wireStartNode) return;
      const d = Math.sqrt((pt.x-npos[0])**2 + (pt.z-npos[2])**2);
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
        // ✅ Valid connection
        const targetPos = NODE_ATTACH[hoverTarget];
        setSparks(prev => [...prev, { id: Date.now(), pos: targetPos }]);
        setRipples(prev => [...prev, { id: Date.now(), pos: [targetPos[0],0,targetPos[2]] }]);
        setFlashLines(prev => new Set([...prev, step]));
        setTimeout(() => setFlashLines(prev => { const s = new Set(prev); s.delete(step); return s; }), 900);
        onSuccessfulConnection(step);
      } else {
        // ❌ Invalid connection
        setErrorPos([wireDragPos[0], 0, wireDragPos[2]]);
        setTimeout(() => setErrorPos(null), 700);
        onFailedConnection();
      }
    } else {
      // Dropped in empty space
      setErrorPos([wireDragPos[0], 0, wireDragPos[2]]);
      setTimeout(() => setErrorPos(null), 500);
    }
    setHoverTarget(null);
    setWireStartNode(null);
  }, [wireDragging, hoverTarget, wireStartNode, step, wireDragPos, orbitRef, onSuccessfulConnection, onFailedConnection]);

  // Global pointer-up safety net: if the user releases the mouse anywhere
  // outside the Three.js canvas the DragPlane never receives the event,
  // leaving the scene frozen. This listener catches that case.
  // Also guard against Escape key to cancel a stuck drag.
  useEffect(() => {
    if (!wireDragging) return;
    const onGlobalPointerUp = () => handleRelease();
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') handleRelease(); };
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('keydown', onEscape);
    };
  }, [wireDragging, handleRelease]);

  // Cleanup old effects
  useEffect(() => {
    if (!sparks.length) return;
    const t = setTimeout(() => setSparks(prev => prev.filter(s => Date.now()-s.id < 1500)), 1600);
    return () => clearTimeout(t);
  }, [sparks]);
  useEffect(() => {
    if (!ripples.length) return;
    const t = setTimeout(() => setRipples(prev => prev.filter(r => Date.now()-r.id < 1200)), 1300);
    return () => clearTimeout(t);
  }, [ripples]);

  const dropZones = [
    { id:'transformer', pos:[-15,0,0] as [number,number,number], label:'Transformer' },
    { id:'tower1', pos:[-8,0,0] as [number,number,number], label:'Tower 1' },
    { id:'tower2', pos:[0,0,0] as [number,number,number], label:'Tower 2' },
    { id:'tower3', pos:[8,0,0] as [number,number,number], label:'Tower 3' },
    { id:'substation', pos:[14,0,0] as [number,number,number], label:'Substation' },
  ];

  return (
    <>
      <DragPlane active={wireDragging} onMove={handlePointerMove} onRelease={handleRelease} />

      {/* Ground */}
      <mesh position={[0,-0.1,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[60,40]} />
        <meshStandardMaterial color="#86efac" roughness={0.9} />
      </mesh>

      {/* Drop zones (build phase only) */}
      {!buildComplete && dropZones.map(z => (
        <DropZone key={z.id} position={z.pos} label={z.label}
          isHighlighted={draggingToolId === z.id} placed={placedItems.has(z.id)} />
      ))}

      {/* Transformer */}
      <Transformer energized={step >= 1} placed={placedItems.has('transformer')}
        isWireSource={wireToolActive && validSource === 'transformer' && !wireDragging && !showExplanation}
        onWireDragStart={() => startWireDrag('transformer')} />
      {placedItems.has('transformer') && (
        <Label3D position={[-15,6.5,0]} text="Step-Up Transformer (132 kV)" active={step >= 1} yOffset={2.5} />
      )}
      {/* Source halo on transformer when it's the valid start */}
      {wireToolActive && validSource === 'transformer' && !wireDragging && placedItems.has('transformer') && !showExplanation && (
        <SourceHalo position={NODE_ATTACH['transformer']} />
      )}

      {/* Towers */}
      {TOWER_POSITIONS.map((pos, i) => {
        const tId = `tower${i+1}`;
        const isWireSrc = wireToolActive && validSource === tId && !wireDragging && !showExplanation;
        const isWireTgt = wireDragging && hoverTarget === tId;
        return (
          <React.Fragment key={i}>
            <Tower position={pos} active={step > i}
              isWireSource={isWireSrc} isWireTarget={isWireTgt}
              isDragging={wireDragging} placed={placedItems.has(tId)}
              onWireDragStart={() => startWireDrag(tId)} />
            {placedItems.has(tId) && (
              <Label3D position={[pos[0],11.5,pos[2]]} text={`Transmission Tower ${i+1}`} active={step > i} yOffset={1.5} />
            )}
            {/* Source halo on tower */}
            {isWireSrc && placedItems.has(tId) && (
              <SourceHalo position={NODE_ATTACH[tId]} />
            )}
          </React.Fragment>
        );
      })}

      {/* Target highlight halo on hovered node */}
      {wireDragging && hoverTarget && hoverTarget !== wireStartNode && validTarget === hoverTarget && (
        <Html position={[NODE_ATTACH[hoverTarget][0], NODE_ATTACH[hoverTarget][1]+1.5, NODE_ATTACH[hoverTarget][2]]} center>
          <div style={{
            pointerEvents:'none', background:'rgba(15,23,42,0.92)', color:'#4ade80',
            padding:'5px 14px', borderRadius:'14px', fontSize:'11px', fontWeight:700,
            whiteSpace:'nowrap', border:'1.5px solid #4ade80', boxShadow:'0 0 12px rgba(74,222,128,0.5)',
          }}>✓ Release to connect!</div>
        </Html>
      )}

      {/* Wire drag preview */}
      {wireDragging && <DraggableWire start={wireStartPos} end={wireDragPos} />}

      {/* Drag tooltip */}
      {wireDragging && hoverTarget !== validTarget && (
        <Html position={[wireDragPos[0], wireDragPos[1]+1.5, wireDragPos[2]]} center>
          <div style={{
            pointerEvents:'none', background:'rgba(15,23,42,0.88)', color:'#93c5fd',
            padding:'5px 14px', borderRadius:'14px', fontSize:'11px', fontWeight:700,
            whiteSpace:'nowrap', border:'1.5px solid #60a5fa', boxShadow:'0 0 10px rgba(96,165,250,0.4)',
          }}>
            Connect to: {validTarget === 'tower1' ? 'Tower 1' : validTarget === 'tower2' ? 'Tower 2' : 'Tower 3'}
          </div>
        </Html>
      )}

      {/* Active power lines — now includes transformer → tower1 */}
      {step >= 1 && <PowerLine start={[-15,8.5,0]} end={[-8,8.5,0]} active flash={flashLines.has(0)} />}
      {step >= 2 && <PowerLine start={[-8,8.5,0]} end={[0,8.5,0]} active flash={flashLines.has(1)} />}
      {step >= 3 && <PowerLine start={[0,8.5,0]} end={[8,8.5,0]} active flash={flashLines.has(2)} />}

      {/* Electric particles */}
      {step >= 1 && <ElectricParticles start={[-15,8.5,0]} end={[-8,8.5,0]} active speed={step>=3?0.75:0.45} />}
      {step >= 2 && <ElectricParticles start={[-8,8.5,0]} end={[0,8.5,0]} active speed={step>=3?0.75:0.45} />}
      {step >= 3 && <ElectricParticles start={[0,8.5,0]} end={[8,8.5,0]} active speed={step>=3?0.75:0.45} />}

      {/* Effects */}
      {sparks.map(s => <SparkBurst key={s.id} position={s.pos} />)}
      {ripples.map(r => <GroundRipple key={r.id} position={r.pos} />)}
      {errorPos && <ErrorRing position={errorPos} />}

      {/* Substation */}
      <Substation3D active={step >= 3} placed={placedItems.has('substation')} />
      {placedItems.has('substation') && (
        <Label3D position={[14,7,0]} text="Substation (Step-Down)" active={step>=3} yOffset={2.5} />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOLKIT PANEL (HTML)
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
        background: active ? 'linear-gradient(135deg,rgba(34,211,238,0.25),rgba(96,165,250,0.2))'
          : placed ? 'rgba(30,41,59,0.3)' : item.bg,
        border: active ? '1.5px solid #22d3ee' : placed ? '1.5px solid rgba(71,85,105,0.4)' : `1.5px solid ${item.color}55`,
        opacity: disabled || locked ? 0.45 : 1,
        transition: 'all 0.2s ease', userSelect:'none',
        boxShadow: active ? '0 0 12px rgba(34,211,238,0.35)' : isDraggingThis ? `0 0 16px ${item.color}88` : 'none',
      }}
    >
      <span style={{fontSize:'20px',lineHeight:1}}>{item.icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:'11px',fontWeight:700,color:placed&&!isWire?'#64748b':'#f1f5f9',lineHeight:1.2}}>{item.label}</div>
        <div style={{fontSize:'10px',color:placed&&!isWire?'#475569':'#94a3b8',marginTop:'1px'}}>{item.sublabel}</div>
      </div>
      {placed && !isWire && <span style={{fontSize:'12px',color:'#22c55e'}}>✓</span>}
      {active && <span style={{fontSize:'11px',color:'#22d3ee',fontWeight:700}}>ON</span>}
      {locked && <span style={{fontSize:'14px'}}>🔒</span>}
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
    zIndex:20, width:'168px', display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'auto',
  }}>
    <div style={{
      background:'rgba(15,23,42,0.88)', backdropFilter:'blur(16px)', borderRadius:'16px', padding:'12px',
      border:'1.5px solid rgba(99,102,241,0.4)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div style={{fontSize:'10px',fontWeight:800,letterSpacing:'0.1em',color:'#818cf8',marginBottom:'10px',textAlign:'center'}}>
        🔧 TOOLKIT
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
        {TOOLKIT_ITEMS.map(item => {
          const isWire = item.id === 'wire';
          const placed = placedItems.has(item.id);
          const active = isWire && wireToolActive;
          const locked = isWire && !buildComplete;
          return (
            <ToolkitItem key={item.id} item={item} placed={placed&&!isWire} active={active} locked={locked}
              isDraggingThis={draggingToolId === item.id}
              onDragStart={() => { if (isWire) { if (buildComplete) onToggleWireTool(); return; } if (!placed) onItemDragStart(item.id); }}
              onDragEnd={() => { if (!isWire && !placed) onItemDragEnd(item.id); }} />
          );
        })}
      </div>
    </div>
    <motion.div key={hint} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} style={{
      background:'rgba(15,23,42,0.88)', backdropFilter:'blur(12px)', borderRadius:'12px', padding:'10px 11px',
      border:'1.5px solid rgba(99,102,241,0.3)', boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{fontSize:'9px',fontWeight:700,color:'#818cf8',marginBottom:'5px',letterSpacing:'0.08em'}}>💡 NEXT STEP</div>
      <div style={{fontSize:'10.5px',color:'#cbd5e1',lineHeight:1.5,fontWeight:500}}>{hint}</div>
    </motion.div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DRAG GHOST
// ─────────────────────────────────────────────────────────────────────────────

const DragGhost = ({ item, pos }: { item: typeof TOOLKIT_ITEMS[0]|null; pos:{x:number;y:number} }) => {
  if (!item) return null;
  return (
    <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:0.92}} style={{
      position:'fixed', left:pos.x+12, top:pos.y-24, zIndex:9999, pointerEvents:'none',
      background:item.bg, border:`2px solid ${item.color}`, borderRadius:'10px', padding:'6px 12px',
      boxShadow:`0 4px 20px ${item.color}55`, display:'flex', alignItems:'center', gap:'8px', backdropFilter:'blur(8px)',
    }}>
      <span style={{fontSize:'18px'}}>{item.icon}</span>
      <span style={{fontSize:'11px',fontWeight:700,color:'#f1f5f9',whiteSpace:'nowrap'}}>{item.label}</span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LEVEL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const Level3Transmission = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();

  // ── Core game state ──
  const [connections, setConnections] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  // ── Build phase state ──
  const [placedItems, setPlacedItems] = useState<Set<string>>(new Set());
  const [buildComplete, setBuildComplete] = useState(false);
  const [wireToolActive, setWireToolActive] = useState(false);

  // ── Toolkit drag state ──
  const [draggingToolId, setDraggingToolId] = useState<string|null>(null);
  const [ghostPos, setGhostPos] = useState({x:0,y:0});

  const orbitRef = useRef<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoltMessage('🔧 Drag components from the toolkit to build the transmission network!');
  }, []);

  useEffect(() => {
    if (REQUIRED_ITEMS.every(id => placedItems.has(id))) {
      setBuildComplete(true);
      setVoltMessage('✅ All components placed! Click the Wire Tool then drag wires between components!');
    }
  }, [placedItems]);

  // ── Successful connection handler (replaces handleTowerClick) ──
  const handleSuccessfulConnection = useCallback((connectionIndex: number) => {
    const key = CONNECTION_FLOW[connectionIndex];
    const newConnections = [...connections, key];
    setConnections(newConnections);
    const nextStep = newConnections.length;
    setStep(nextStep);
    setShowExplanation(true);

    if (connectionIndex === 0) setVoltMessage('✅ Transformer → Tower 1! High voltage (132 kV) reduces energy loss. P = I²R — less current = less heat!');
    if (connectionIndex === 1) setVoltMessage('✅ Tower 1 → Tower 2! Electricity travels at near light speed through these wires!');
    if (connectionIndex === 2) {
      setVoltMessage('⭐ All towers connected! 132,000 Volts of power is now flowing to Spark City!');
      setLevelComplete(true);
      addScore(100);
      addStar();
    }
  }, [connections, setLevelComplete, addScore, addStar, setVoltMessage]);

  const handleFailedConnection = useCallback(() => {
    setVoltMessage('❌ Wrong connection! Check the flow: Transformer → Tower 1 → Tower 2 → Tower 3');
  }, [setVoltMessage]);

  const handleContinue = () => setShowExplanation(false);

  // ── Toolkit drag ──
  const handleItemDragStart = useCallback((id: string) => {
    setDraggingToolId(id);
    document.body.style.cursor = 'grabbing';
  }, []);
  const handleItemDragEnd = useCallback((id: string) => {
    setDraggingToolId(null);
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (draggingToolId) setGhostPos({x:e.clientX,y:e.clientY}); };
    const onUp = (e: PointerEvent) => {
      if (!draggingToolId) return;
      const toolId = draggingToolId;
      setDraggingToolId(null);
      document.body.style.cursor = 'default';
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
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
        ? '〰️ Wire Tool active! Click a glowing ◉ node then drag to the next component!'
        : 'Wire tool off. Click it again to re-enable.');
      return next;
    });
  };

  // ── Hint logic ──
  const hint = useMemo(() => {
    if (!buildComplete) {
      const rem = REQUIRED_ITEMS.filter(id => !placedItems.has(id));
      if (rem.length === REQUIRED_ITEMS.length) return 'Drag components from here into the scene to build the network!';
      if (rem.length > 0) {
        const labels: Record<string,string> = {transformer:'Transformer',tower1:'Tower 1',tower2:'Tower 2',tower3:'Tower 3',substation:'Substation'};
        return `Still need: ${rem.map(id => labels[id]).join(', ')}`;
      }
    }
    if (!wireToolActive) return 'All placed! Click the 〰️ Wire Tool to start connecting!';
    if (step === 0) return 'Click the cyan ◉ on the Transformer and drag to Tower 1!';
    if (step === 1) return 'Click the cyan ◉ on Tower 1 and drag to Tower 2!';
    if (step === 2) return 'Last one! Click Tower 2 ◉ and drag to Tower 3!';
    return '⚡ Network complete! Electricity is flowing!';
  }, [buildComplete, placedItems, wireToolActive, step]);

  const explanationStep = Math.min(step - 1, STEP_EXPLANATIONS.length - 1);
  const currentExplanation = STEP_EXPLANATIONS[Math.max(0, explanationStep)];
  const ghostItem = draggingToolId ? TOOLKIT_ITEMS.find(i => i.id === draggingToolId) ?? null : null;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0"
        style={{background:'linear-gradient(180deg,#f0f9ff 0%,#e0f2fe 50%,#d8f0d8 100%)'}} />

      {/* 3-D Canvas */}
      <div ref={canvasRef} className="absolute inset-0">
        <Canvas style={{width:'100%',height:'100%'}} camera={{position:[0,6,24],fov:60}} shadows>
          <ambientLight intensity={0.75} />
          <directionalLight position={[10,15,8]} intensity={1.0} castShadow />
          <pointLight position={[0,10,0]} color="#f59e0b" intensity={step>=3?3:0} distance={40} />
          <Environment preset="park" />
          <OrbitControls ref={orbitRef} enablePan={false} minDistance={5} maxDistance={35} maxPolarAngle={Math.PI/2.2} />
          <SceneContent
            connections={connections} showExplanation={showExplanation} orbitRef={orbitRef}
            placedItems={placedItems} buildComplete={buildComplete}
            wireToolActive={wireToolActive} draggingToolId={draggingToolId}
            onSuccessfulConnection={handleSuccessfulConnection}
            onFailedConnection={handleFailedConnection}
          />
        </Canvas>
      </div>

      <DragGhost item={ghostItem} pos={ghostPos} />

      <ToolkitPanel
        placedItems={placedItems} buildComplete={buildComplete}
        wireToolActive={wireToolActive} onToggleWireTool={toggleWireTool}
        draggingToolId={draggingToolId}
        onItemDragStart={handleItemDragStart} onItemDragEnd={handleItemDragEnd}
        hint={hint}
      />

      {/* Explanation panel */}
      <AnimatePresence>
        {showExplanation && step > 0 && step <= 4 && (
          <motion.div initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.85}}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{background:'rgba(0,0,0,0.15)'}}>
            <motion.div initial={{y:30}} animate={{y:0}} className="flex flex-col items-center gap-4 px-8 py-7 rounded-3xl"
              style={{background:'rgba(255,255,255,0.97)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
                border:'3px solid #fbbf24',maxWidth:440,width:'90%'}}>
              <div className={`w-full px-4 py-3 rounded-2xl bg-gradient-to-r ${currentExplanation.color} text-white text-center font-display font-bold`}
                style={{fontSize:'1.1rem'}}>
                {currentExplanation.icon} {currentExplanation.title}
              </div>
              <p className="text-slate-700 leading-relaxed text-center" style={{fontSize:'0.95rem'}}>
                {currentExplanation.info}
              </p>
              <div className="px-4 py-2.5 rounded-xl w-full text-center" style={{background:'#fefce8',border:'2px solid #fde047'}}>
                <code className="font-bold text-amber-700" style={{fontSize:'1.1rem'}}>{currentExplanation.formula}</code>
                <p className="text-amber-600 mt-0.5" style={{fontSize:'0.78rem'}}>{currentExplanation.formulaNote}</p>
              </div>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={handleContinue}
                className="px-8 py-3 rounded-2xl font-display font-bold text-white"
                style={{
                  background: step<3 ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'linear-gradient(135deg,#10b981,#34d399)',
                  fontSize:'1.05rem',
                  boxShadow: step<3 ? '0 4px 16px rgba(245,158,11,0.4)' : '0 4px 16px rgba(16,185,129,0.4)',
                }}>
                {step<3 ? `Continue → Wire Tower ${step+1}` : '🎉 See Results!'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right panel */}
      <div className="absolute right-3 top-14 z-10 flex flex-col gap-3 pointer-events-auto"
        style={{width:'clamp(210px,23vw,285px)'}}>
        <InfoCard title="Why High Voltage?" icon="🗼" colorClass="from-amber-600 to-amber-400">
          <p><strong>Power Loss = I²R</strong> — Doubling voltage halves current, so energy loss is reduced 4×!</p>
          <p><strong>Step-Up Transformer:</strong> 11 kV → 132 kV using V₁/V₂ = N₁/N₂ (turns ratio).</p>
          <p><strong>Distance:</strong> High-voltage lines carry power 500+ km with minimal waste!</p>
        </InfoCard>
        <div className="game-panel">
          <h3 className="font-display font-bold text-slate-800 mb-3" style={{fontSize:'1.05rem'}}>Transmission Status</h3>
          <div className="flex gap-2">
            {['T→1','1→2','2→3'].map((label, i) => (
              <div key={i} className="flex-1 text-center py-2.5 rounded-xl font-display font-bold transition-all"
                style={{
                  background: step>i ? 'rgba(245,158,11,0.15)' : '#f1f5f9',
                  color: step>i ? '#d97706' : '#94a3b8',
                  border:`2px solid ${step>i ? 'rgba(245,158,11,0.5)' : 'transparent'}`,
                  fontSize:'0.8rem',
                }}>{label}</div>
            ))}
          </div>
          {!showExplanation && step < 3 && buildComplete && (
            <p className="text-center mt-2.5 font-bold animate-pulse" style={{color:'#22d3ee',fontSize:'0.88rem'}}>
              〰️ Wire connection {step+1}/3 next!
            </p>
          )}
          {!buildComplete && (
            <p className="text-center mt-2.5 font-bold animate-pulse" style={{color:'#818cf8',fontSize:'0.88rem'}}>
              🔧 Place components first! ({REQUIRED_ITEMS.filter(id => placedItems.has(id)).length}/{REQUIRED_ITEMS.length})
            </p>
          )}
        </div>
        <div className="game-panel text-center">
          <p className="font-display text-slate-500 mb-1" style={{fontSize:'0.75rem'}}>TRANSMISSION VOLTAGE</p>
          <p className="text-amber-500 font-mono font-bold" style={{fontSize:'2rem'}}>132 kV</p>
          <p className="mt-1" style={{color:'#64748b',fontSize:'0.78rem'}}>
            {step>=3 ? '✓ Reaching the Substation!' : 'Awaiting all connections...'}
          </p>
        </div>
      </div>

      {/* Bottom prompt */}
      {!showExplanation && (
        <motion.div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none z-20"
          animate={{y:[0,-8,0]}} transition={{duration:1.2,repeat:Infinity}}>
          <div className="px-5 py-3 rounded-full font-display font-bold shadow-xl" style={{
            background: buildComplete && wireToolActive
              ? 'linear-gradient(135deg,#22d3ee,#3b82f6)'
              : buildComplete
                ? 'linear-gradient(135deg,#818cf8,#6366f1)'
                : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
            color:'#fff', fontSize:'1.05rem',
            boxShadow: buildComplete&&wireToolActive ? '0 0 20px rgba(34,211,238,0.5)'
              : buildComplete ? '0 0 20px rgba(129,140,248,0.5)' : '0 0 20px rgba(255,215,0,0.5)',
          }}>
            {!buildComplete
              ? `🔧 Build the network! (${REQUIRED_ITEMS.filter(id=>placedItems.has(id)).length}/${REQUIRED_ITEMS.length} placed)`
              : !wireToolActive
                ? '〰️ Click Wire Tool → drag wires between components!'
                : step<3
                  ? `⚡ Drag from glowing ◉ node → next tower! (${step}/3 connected)`
                  : '⚡ Network complete — power is flowing!'}
          </div>
        </motion.div>
      )}
    </div>
  );
};
