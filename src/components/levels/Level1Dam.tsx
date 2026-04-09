import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

/* ── Component Label (HTML overlay in 3D space) ── */
const Label3D = ({ position, text, color = '#ffffff', bg = 'rgba(0,20,60,0.78)' }: {
  position: [number, number, number];
  text: string;
  color?: string;
  bg?: string;
}) => (
  <Html position={position} center distanceFactor={14} zIndexRange={[10, 20]}>
    <div style={{
      background: bg,
      color,
      padding: '3px 10px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      border: `1px solid ${color}44`,
      pointerEvents: 'none',
      letterSpacing: 0.5,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {text}
    </div>
  </Html>
);

/* ── Reservoir water ── */
const ReservoirWater = ({ flow }: { flow: boolean }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const surfaceRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    const t = clock.getElapsedTime();
    if (flow) {
      mat.emissiveIntensity = 0.18 + Math.sin(t * 2.5) * 0.08;
    } else {
      mat.emissiveIntensity = 0.06 + Math.sin(t * 1.2) * 0.03;
    }
    // Gentle wave on surface
    if (surfaceRef.current) {
      surfaceRef.current.position.y = 0.44 + Math.sin(t * 1.5) * 0.04;
    }
  });
  return (
    <group>
      {/* Deep water body */}
      <mesh ref={ref} position={[-10.5, 0.1, 0]}>
        <boxGeometry args={[20, 0.8, 18]} />
        <meshStandardMaterial
          color="#0a4a8a"
          transparent opacity={0.92}
          emissive="#0066cc"
          emissiveIntensity={0.06}
          roughness={0.1}
          metalness={0.05}
        />
      </mesh>
      {/* Animated reflective surface */}
      <mesh ref={surfaceRef} position={[-10.5, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 18, 12, 12]} />
        <meshStandardMaterial
          color={flow ? '#2090ff' : '#1a6abf'}
          transparent opacity={flow ? 0.78 : 0.62}
          emissive={flow ? '#0055cc' : '#003388'}
          emissiveIntensity={flow ? 0.22 : 0.08}
          roughness={0.05}
          metalness={0.15}
        />
      </mesh>
      {/* Label */}
      <Label3D position={[-10.5, 2.8, 0]} text="💧 Stored Water (Reservoir)" color="#7dd3fc" bg="rgba(0,30,80,0.82)" />
    </group>
  );
};

/* ── Gate with open/close animation ── */
const Gate = ({ open, onClick, phase }: { open: boolean; onClick: () => void; phase: number }) => {
  const gateRef = useRef<THREE.Mesh>(null!);
  const animRef = useRef({ y: 1.2, targetY: 1.2 });
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }, dt) => {
    const a = animRef.current;
    a.targetY = open ? 4.5 : 1.2;
    a.y += (a.targetY - a.y) * Math.min(dt * 3.5, 1);
    if (gateRef.current) gateRef.current.position.y = a.y;

    if (glowRef.current && !open) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(clock.getElapsedTime() * 3) * 0.4;
    }
  });

  return (
    <group>
      {/* Gate guide rails */}
      {[-1.6, 1.6].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 1.3]}>
          <boxGeometry args={[0.18, 6.5, 0.18]} />
          <meshStandardMaterial color="#555566" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Gate panel */}
      <mesh
        ref={gateRef}
        position={[0, 1.2, 1.3]}
        onClick={onClick}
        onPointerOver={() => { if (phase === 0) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
        castShadow
      >
        <boxGeometry args={[3, 3.2, 0.35]} />
        <meshStandardMaterial
          color={open ? '#22c55e' : '#ffd700'}
          emissive={open ? '#00ff44' : '#ffaa00'}
          emissiveIntensity={open ? 0.2 : 0.9}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>
      {/* Glow halo when closed */}
      {!open && (
        <mesh ref={glowRef} position={[0, 1.2, 1.4]}>
          <planeGeometry args={[3.6, 3.8]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffcc00" emissiveIntensity={0.8} transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Label */}
      <Label3D
        position={[0, open ? 5.6 : 3.4, 1.3]}
        text={open ? '🟢 Gate OPEN' : '🟡 Gate (Click to Open!)'}
        color={open ? '#86efac' : '#fde68a'}
        bg={open ? 'rgba(0,80,30,0.85)' : 'rgba(80,50,0,0.85)'}
      />
    </group>
  );
};

/* ── Turbine — clearly visible blades ── */
const Turbine = ({ spinning, phase }: { spinning: boolean; phase: number }) => {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (spinning && group.current) group.current.rotation.z -= dt * (phase >= 2 ? 8 : 4);
  });
  return (
    <group>
      <group ref={group} position={[4.5, 1.8, 0.5]}>
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.7, 24]} />
          <meshStandardMaterial color="#c8820a" metalness={0.8} roughness={0.2} />
        </mesh>
        {[...Array(8)].map((_, i) => (
          <group key={i} rotation={[0, 0, (Math.PI * 2 / 8) * i]}>
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[0.38, 1.9, 0.22]} />
              <meshStandardMaterial color="#d4900a" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.1, 0.12, 8, 32]} />
          <meshStandardMaterial color="#b87020" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      <Label3D position={[4.5, 4.4, 0.5]} text="⚙️ Turbine" color="#fcd34d" bg="rgba(60,30,0,0.82)" />
    </group>
  );
};

/* ── Water flow particles ── */
const FlowParticles = ({ active }: { active: boolean }) => {
  const pts = useRef<THREE.Points>(null!);
  const COUNT = 220;
  const posRef = useRef(new Float32Array(COUNT * 3));

  useEffect(() => {
    const arr = posRef.current;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 2 - 5;
      arr[i * 3 + 1] = 0.5 + Math.random() * 1.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
    }
  }, []);

  useFrame((_, dt) => {
    if (!active || !pts.current) return;
    const arr = posRef.current;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] += dt * 6;
      if (arr[i * 3] > 5.5) {
        arr[i * 3] = -7;
        arr[i * 3 + 1] = 0.5 + Math.random() * 1.2;
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#60c8ff" size={0.26} transparent opacity={active ? 0.95 : 0} />
    </points>
  );
};

/* ── Generator with rotor glow ── */
const GeneratorGlow = ({ on }: { on: boolean }) => {
  const mesh = useRef<THREE.Mesh>(null!);
  const rotorRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = on ? 0.55 + Math.sin(clock.getElapsedTime() * 5) * 0.4 : 0;
    if (rotorRef.current && on) rotorRef.current.rotation.y += 0.06;
  });
  return (
    <group>
      <group position={[8.5, 1.8, 0.5]}>
        <mesh ref={mesh} castShadow>
          <cylinderGeometry args={[1.4, 1.4, 3.2, 24]} />
          <meshStandardMaterial color="#1a3a5c" emissive="#00aaff" emissiveIntensity={0} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={rotorRef}>
          <cylinderGeometry args={[0.7, 0.7, 3.6, 16]} />
          <meshStandardMaterial color="#b87020" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.2, 24]} />
          <meshStandardMaterial color="#22334a" metalness={0.9} />
        </mesh>
        <mesh position={[0, -1.7, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.2, 24]} />
          <meshStandardMaterial color="#22334a" metalness={0.9} />
        </mesh>
      </group>
      <Label3D position={[8.5, 4.5, 0.5]} text="⚡ Generator" color="#93c5fd" bg="rgba(0,20,80,0.85)" />
    </group>
  );
};

/* ── Electricity bolts ── */
const ElectricBolts = ({ on }: { on: boolean }) => {
  const ref1 = useRef<THREE.Mesh>(null!);
  const ref2 = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref1.current) ref1.current.visible = on && Math.sin(t * 18) > 0;
    if (ref2.current) ref2.current.visible = on && Math.sin(t * 18 + 1.5) > 0;
  });
  return (
    <>
      <mesh ref={ref1} position={[8.5, 4.5, 0.5]}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={3} />
      </mesh>
      <mesh ref={ref2} position={[8.5, 5.2, 0.5]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={3} />
      </mesh>
    </>
  );
};

/* ── Animated electricity kV counter ── */
const ElectricityCounter = ({ active, onDone }: { active: boolean; onDone: () => void }) => {
  const [kv, setKv] = useState(0);
  const [showFlow, setShowFlow] = useState(false);
  const doneCalledRef = useRef(false);

  useEffect(() => {
    if (!active) { setKv(0); setShowFlow(false); doneCalledRef.current = false; return; }

    setShowFlow(true);
    let val = 0;
    const interval = setInterval(() => {
      val += 2 + Math.random() * 4;
      if (val >= 240) { val = 240; clearInterval(interval); }
      setKv(Math.round(val));
    }, 80);

    const timer = setTimeout(() => {
      if (!doneCalledRef.current) { doneCalledRef.current = true; onDone(); }
    }, 7500);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [active]);

  if (!showFlow) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      style={{ bottom: '22%' }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,10,40,0.95), rgba(0,30,80,0.92))',
        border: '2px solid #fbbf24',
        borderRadius: 18,
        padding: '14px 32px',
        textAlign: 'center',
        boxShadow: '0 0 40px rgba(255,200,0,0.55), 0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
          ⚡ ELECTRICITY GENERATED
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'center' }}>
          <motion.span
            key={kv}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            style={{ color: '#fde047', fontSize: 52, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}
          >
            {kv}
          </motion.span>
          <span style={{ color: '#fbbf24', fontSize: 22, fontWeight: 700 }}>V AC</span>
        </div>
        <div style={{ color: '#22d3ee', fontSize: 13, marginTop: 4, fontWeight: 600 }}>
          {kv >= 240 ? '✅ Full Output: 0.24 kV — Ready for Transmission!' : '📈 Building up power...'}
        </div>
        {/* Flow line animation */}
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ height: '100%', width: '50%', background: 'linear-gradient(90deg, transparent, #fde047, transparent)', borderRadius: 3 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

/* ── Level Summary Card ── */
const SummaryCard = ({ onNext }: { onNext: () => void }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, type: 'spring', bounce: 0.35 }}
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto"
      style={{ background: 'rgba(0,10,30,0.82)' }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
        border: '2px solid #38bdf8',
        borderRadius: 24,
        padding: '36px 40px',
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 0 60px rgba(56,189,248,0.3), 0 20px 60px rgba(0,0,0,0.7)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
        <h2 style={{ color: '#fde047', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
          Level 1 Complete!
        </h2>
        <p style={{ color: '#7dd3fc', fontSize: 13, fontWeight: 600, marginBottom: 20, letterSpacing: 0.5 }}>
          What you learned in this level:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, textAlign: 'left' }}>
          {[
            { icon: '💧', title: 'Water Stores Energy', desc: 'Reservoirs hold water at height — this is Potential Energy (PE = mgh). The higher the water, the more energy it holds.' },
            { icon: '🚪', title: 'Gate Controls Flow', desc: 'Opening the dam gate releases water, which rushes downward converting Potential Energy → Kinetic Energy.' },
            { icon: '⚙️', title: 'Turbine Converts Motion', desc: 'Rushing water spins the turbine blades. Kinetic energy becomes mechanical rotation energy.' },
            { icon: '⚡', title: 'Generator Creates Electricity', desc: 'The spinning turbine drives the generator. By Faraday\'s Law (EMF = −dΦ/dt), rotating magnets produce 240V AC electricity.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{item.title}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(253,224,71,0.1)', border: '1px solid #fde047', borderRadius: 12, padding: '10px 16px', marginBottom: 22 }}>
          <span style={{ color: '#fde047', fontWeight: 700, fontSize: 14 }}>⚡ Output: 240V AC (0.24 kV) — Sent to the power grid!</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          onClick={onNext}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            border: 'none',
            borderRadius: 14,
            padding: '13px 36px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(37,99,235,0.5)',
          }}
        >
          Explore Generator in Detail
        </motion.button>
      </div>
    </motion.div>
  </AnimatePresence>
);

/* ── Steps config ── */
const STEPS = [
  {
    phase: 0,
    title: 'Ready!',
    hint: '👆 TAP the YELLOW GATE on the Dam to release water!',
    voltMsg: "Welcome to the Hydroelectric Dam! 💧 Tap the GLOWING YELLOW GATE to open it and release the stored water!",
  },
  {
    phase: 1,
    title: 'Gate Opened — Water Flows!',
    hint: 'Water rushing toward turbine! Click "Next Step" to spin the turbine.',
    voltMsg: "💧 The GATE is open! Water stored HIGH has POTENTIAL ENERGY (PE = mgh). It rushes down, turning into KINETIC ENERGY!",
  },
  {
    phase: 2,
    title: 'Turbine Spinning!',
    hint: 'The turbine is converting water energy to mechanical energy! Click "Next Step" to power the generator.',
    voltMsg: "⚙️ TURBINE SPINNING! Kinetic energy → Mechanical rotation. By FARADAY'S LAW, moving magnets create electricity!",
  },
  {
    phase: 3,
    title: '⚡ Electricity Generated!',
    hint: '🎉 The generator is producing 240V AC power for Spark City!',
    voltMsg: "⭐ AMAZING! The GENERATOR converts mechanical energy → 240V AC Electricity using electromagnetic induction. Power flows to the city!",
  },
];

/* ── Main Level ── */
export const Level1Dam = () => {
  
  const { setVoltMessage, setLevelComplete, addScore, addStar, nextLevel } = useGameStore();
  const [phase, setPhase] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [electricityDone, setElectricityDone] = useState(false);

  const gateOpen = phase >= 1;
  const waterFlowing = phase >= 1;
  const turbineOn = phase >= 2;
  const generating = phase >= 3;

  useEffect(() => {
    setVoltMessage(STEPS[0].voltMsg);
  }, []);

  useEffect(() => {
    setVoltMessage(STEPS[Math.min(phase, STEPS.length - 1)].voltMsg);
    if (phase === 3) {
      setLevelComplete(true);
      addScore(100);
      addStar();
    }
  }, [phase]);

  const handleGate = () => {
    if (phase !== 0) return;
    setPhase(1);
  };

  const handleNext = () => {
    if (phase < 3) setPhase(p => p + 1);
  };

  const handleElectricityDone = () => {
    setElectricityDone(true);
    setTimeout(() => setShowSummary(true), 400);
  };

 

  const handleSummaryNext = () => {
  setShowSummary(false);
  nextLevel(); // 🔥 THIS IS THE KEY
};

  const currentStep = STEPS[Math.min(phase, STEPS.length - 1)];

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Sky gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1a4a8a 0%,#2d7dd2 38%,#5ba3e8 68%,#87ceeb 100%)' }} />

      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [-2, 10, 22], fov: 52 }}
        shadows
      >
        <color attach="background" args={['#87ceeb']} />
        <fog attach="fog" args={['#b0d8f0', 35, 80]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[15, 18, 10]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <hemisphereLight args={['#87ceeb', '#5a9a4a', 0.45]} />
        <pointLight position={[8.5, 5, 0.5]} color="#00aaff" intensity={generating ? 4 : 0} distance={16} />
        <pointLight position={[4.5, 4, 0.5]} color="#ffd700" intensity={turbineOn ? 2 : 0} distance={12} />
        {/* Water caustic light */}
        <pointLight position={[-10, 3, 0]} color="#0088ff" intensity={1.2} distance={18} />
        <OrbitControls enablePan={false} minDistance={8} maxDistance={26} maxPolarAngle={Math.PI / 2.1} />

        {/* Ground */}
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 40]} />
          <meshStandardMaterial color="#5a9a4a" roughness={0.9} />
        </mesh>

        <ReservoirWater flow={waterFlowing} />

        {/* Mountains */}
        {([[-7, 3.5, -12], [9, 4.5, -12], [-14, 2.5, -7], [16, 3, -8]] as [number, number, number][]).map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <coneGeometry args={[4 + i * 0.6, 7 + i, 16]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#4a7a4a' : '#567a56'} roughness={0.95} />
          </mesh>
        ))}

        {/* Dam body */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 6, 2.5]} />
          <meshStandardMaterial color="#7a7a7a" roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Dam label */}
        <Label3D position={[0, 6.8, 0]} text="🏗️ Dam Wall" color="#e2e8f0" bg="rgba(30,30,50,0.85)" />

        {/* Dam top walkway */}
        <mesh position={[0, 5.6, 0]}>
          <boxGeometry args={[10.5, 0.5, 2.8]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        {/* Dam buttresses */}
        {[-3.5, 0, 3.5].map((x, i) => (
          <mesh key={i} position={[x, 2, -1.4]} castShadow>
            <boxGeometry args={[0.8, 5, 1.4]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
        ))}

        {/* GATE — with animation */}
        <Gate open={gateOpen} onClick={handleGate} phase={phase} />

        {/* Penstock pipe */}
        <mesh position={[2, 1.2, 1]} rotation={[0, 0, Math.PI / 10]}>
          <cylinderGeometry args={[0.4, 0.4, 4, 16]} />
          <meshStandardMaterial color="#444444" metalness={0.7} />
        </mesh>
        <Label3D position={[2.5, 0.2, 1]} text="Penstock (Pipe)" color="#cbd5e1" bg="rgba(20,20,30,0.8)" />

        {/* Turbine housing */}
        <mesh position={[4.5, 0.8, 0.5]} castShadow>
          <boxGeometry args={[5.5, 2.4, 3]} />
          <meshStandardMaterial color="#c27848" roughness={0.8} />
        </mesh>

        <Turbine spinning={turbineOn} phase={phase} />
        <FlowParticles active={waterFlowing} />
        <GeneratorGlow on={generating} />
        <ElectricBolts on={generating} />

        {/* Powerhouse */}
        <mesh position={[9, 2.5, -1.5]} castShadow>
          <boxGeometry args={[5, 5, 5]} />
          <meshStandardMaterial color="#c07850" roughness={0.85} />
        </mesh>
        <mesh position={[9, 5.2, -1.5]}>
          <boxGeometry args={[5.5, 0.5, 5.5]} />
          <meshStandardMaterial color="#a05c30" />
        </mesh>
        <Label3D position={[9, 7, -1.5]} text="🏭 Powerhouse" color="#fca5a5" bg="rgba(60,10,10,0.82)" />

        {/* Transmission tower */}
        <mesh position={[13, 5, -1.5]}>
          <cylinderGeometry args={[0.1, 0.15, 10, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.6} />
        </mesh>
        <Label3D position={[13, 11, -1.5]} text="🗼 Transmission Tower" color="#d1d5db" bg="rgba(20,20,20,0.82)" />
      </Canvas>

      {/* Electricity counter animation */}
      {generating && !electricityDone && (
        <ElectricityCounter active={generating} onDone={handleElectricityDone} />
      )}

      {/* Summary card */}
      {showSummary && <SummaryCard onNext={handleSummaryNext} />}

      {/* Right panel */}
      {!showSummary && (
        <div
          className="absolute right-3 top-14 z-10 flex flex-col gap-3 pointer-events-auto"
          style={{ width: 'clamp(200px, 22vw, 280px)' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <InfoCard
                title={currentStep.title}
                icon={['🚪', '💧', '⚙️', '⚡'][phase]}
                colorClass={['from-blue-700 to-blue-500', 'from-cyan-600 to-blue-500', 'from-orange-600 to-amber-400', 'from-yellow-500 to-amber-400'][phase]}
              >
                <p className="leading-snug">{currentStep.hint}</p>
              </InfoCard>
            </motion.div>
          </AnimatePresence>

          <InfoCard title="How Hydro Works" icon="🌊" colorClass="from-blue-800 to-blue-600">
            <div className="space-y-1.5">
              {[
                { label: 'Potential Energy', formula: 'PE = mgh', color: '#3b82f6' },
                { label: 'Kinetic Energy', formula: 'KE = ½mv²', color: '#06b6d4' },
                { label: "Faraday's Law", formula: 'EMF = −dΦ/dt', color: '#8b5cf6' },
                { label: 'Power Output', formula: 'P = V × I', color: '#059669' },
              ].map((f) => (
                <div key={f.label} className="flex justify-between items-center">
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>{f.label}</span>
                  <code style={{ fontSize: '0.78rem', color: f.color, fontWeight: 700 }}>{f.formula}</code>
                </div>
              ))}
            </div>
          </InfoCard>

          <div className="game-panel">
            <h3 className="font-display font-bold text-slate-700 mb-3" style={{ fontSize: '0.95rem' }}>Generation Sequence</h3>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Open the Gate', icon: '🚪', done: gateOpen },
                { label: 'Water Flows', icon: '💧', done: waterFlowing },
                { label: 'Turbine Spins', icon: '⚙️', done: turbineOn },
                { label: 'Power Generated!', icon: '⚡', done: generating },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                  <span className="flex-1 font-medium" style={{ fontSize: '0.88rem', color: s.done ? '#059669' : '#94a3b8' }}>
                    {s.label}
                  </span>
                  {s.done && <span style={{ color: '#059669' }}>✓</span>}
                </div>
              ))}
            </div>

            {phase >= 1 && phase < 3 && (
              <motion.button
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleNext}
                className="w-full mt-3 py-2.5 rounded-xl font-display font-bold text-white shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                  fontSize: '1rem',
                  boxShadow: '0 4px 15px rgba(37,99,235,0.45)',
                }}
              >
                {phase === 1 ? '⚙️ Spin the Turbine →' : '⚡ Generate Power →'}
              </motion.button>
            )}

            {generating && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-3 p-3 rounded-xl text-center"
                style={{ background: '#f0fdf4' }}
              >
                <p className="font-mono font-bold text-cyan-500" style={{ fontSize: '1.6rem' }}>240 V AC</p>
                <p className="text-green-600 font-bold" style={{ fontSize: '0.85rem' }}>✓ Ready for Transmission!</p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Bouncing hint */}
      {phase === 0 && (
        <motion.div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none z-20"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        >
          <div
            className="px-5 py-3 rounded-full font-display font-bold text-slate-900 shadow-xl"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '1.05rem', boxShadow: '0 0 24px rgba(255,215,0,0.7)' }}
          >
            👆 TAP the YELLOW GATE on the Dam!
          </div>
        </motion.div>
      )}
    </div>
  );
};
