import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

/* ── Reservoir water ── */
const ReservoirWater = ({ flow }: { flow: boolean }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    if (flow) {
      mat.emissiveIntensity = 0.12 + Math.sin(clock.getElapsedTime() * 3) * 0.06;
    }
  });
  return (
    <mesh ref={ref} position={[-10.5, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 18]} />
      <meshStandardMaterial
        color={flow ? '#1a8cff' : '#2d6a9f'}
        transparent opacity={flow ? 0.85 : 0.55}
        emissive="#0055aa" emissiveIntensity={0}
      />
    </mesh>
  );
};

/* ── Improved Turbine — clearly visible blades ── */
const Turbine = ({ spinning, phase }: { spinning: boolean; phase: number }) => {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (spinning && group.current) group.current.rotation.z -= dt * (phase >= 2 ? 8 : 4);
  });
  return (
    <group ref={group} position={[4.5, 1.8, 0.5]}>
      {/* Hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.7, 24]} />
        <meshStandardMaterial color="#c8820a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8 wide blades — much more visible */}
      {[...Array(8)].map((_, i) => (
        <group key={i} rotation={[0, 0, (Math.PI * 2 / 8) * i]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.38, 1.9, 0.22]} />
            <meshStandardMaterial color="#d4900a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.12, 8, 32]} />
        <meshStandardMaterial color="#b87020" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

/* ── Water flow particles ── */
const FlowParticles = ({ active }: { active: boolean }) => {
  const pts = useRef<THREE.Points>(null!);
  const COUNT = 180;
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
      <pointsMaterial color="#80d4ff" size={0.22} transparent opacity={active ? 0.92 : 0} />
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
    <group position={[8.5, 1.8, 0.5]}>
      {/* Stator — outer casing */}
      <mesh ref={mesh} castShadow>
        <cylinderGeometry args={[1.4, 1.4, 3.2, 24]} />
        <meshStandardMaterial color="#1a3a5c" emissive="#00aaff" emissiveIntensity={0} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Rotor — inner rotating cylinder */}
      <mesh ref={rotorRef}>
        <cylinderGeometry args={[0.7, 0.7, 3.6, 16]} />
        <meshStandardMaterial color="#b87020" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* End caps */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 24]} />
        <meshStandardMaterial color="#22334a" metalness={0.9} />
      </mesh>
      <mesh position={[0, -1.7, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 24]} />
        <meshStandardMaterial color="#22334a" metalness={0.9} />
      </mesh>
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
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [phase, setPhase] = useState(0);

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

  const currentStep = STEPS[Math.min(phase, STEPS.length - 1)];

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Sky gradient background */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1a4a8a 0%,#2d7dd2 38%,#5ba3e8 68%,#87ceeb 100%)' }} />

      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [-2, 10, 22], fov: 52 }}
        shadows
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[15, 18, 10]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
        <pointLight position={[8.5, 5, 0.5]} color="#00aaff" intensity={generating ? 4 : 0} distance={16} />
        <pointLight position={[4.5, 4, 0.5]} color="#ffd700" intensity={turbineOn ? 2 : 0} distance={12} />
        <Environment preset="sunset" />
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

        {/* Dam body — large grey wall */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 6, 2.5]} />
          <meshStandardMaterial color="#7a7a7a" roughness={0.7} metalness={0.1} />
        </mesh>
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

        {/* GATE — clickable, glowing yellow */}
        <mesh
          position={[0, 1.2, 1.3]}
          onClick={handleGate}
          onPointerOver={() => { if (phase === 0) document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'default'; }}
          castShadow
        >
          <boxGeometry args={[3, 3.2, 0.4]} />
          <meshStandardMaterial
            color={gateOpen ? '#22c55e' : '#ffd700'}
            emissive={gateOpen ? '#00ff00' : '#ffaa00'}
            emissiveIntensity={gateOpen ? 0.3 : 1.2}
            metalness={0.4} roughness={0.3}
          />
        </mesh>

        {/* Penstock pipe */}
        <mesh position={[2, 1.2, 1]} rotation={[0, 0, Math.PI / 10]}>
          <cylinderGeometry args={[0.4, 0.4, 4, 16]} />
          <meshStandardMaterial color="#444444" metalness={0.7} />
        </mesh>

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

        {/* Transmission tower suggestion */}
        <mesh position={[13, 5, -1.5]}>
          <cylinderGeometry args={[0.1, 0.15, 10, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.6} />
        </mesh>
      </Canvas>

      {/* Right panel */}
      <div
        className="absolute right-3 top-14 z-10 flex flex-col gap-3 pointer-events-auto"
        style={{ width: 'clamp(200px, 22vw, 280px)' }}
      >
        {/* Step status card */}
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
              icon={['🚪','💧','⚙️','⚡'][phase]}
              colorClass={['from-blue-700 to-blue-500','from-cyan-600 to-blue-500','from-orange-600 to-amber-400','from-yellow-500 to-amber-400'][phase]}
            >
              <p className="leading-snug">{currentStep.hint}</p>
            </InfoCard>
          </motion.div>
        </AnimatePresence>

        {/* Science facts panel */}
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

        {/* Progress steps */}
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

          {/* Next Step button — appears after gate opened */}
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

      {/* Bouncing hint — only before gate opened */}
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
