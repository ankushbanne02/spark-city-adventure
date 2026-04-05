import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

const Rotor = ({ spinning }: { spinning: boolean }) => {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (spinning && ref.current) ref.current.rotation.z -= dt * 5;
  });
  return (
    <group ref={ref}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (Math.PI / 2) * i;
        const color = i % 2 === 0 ? '#ef4444' : '#3b82f6';
        return (
          <mesh key={i} rotation={[0, 0, angle]}>
            <boxGeometry args={[0.9, 3.2, 0.9]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.5} roughness={0.3} />
          </mesh>
        );
      })}
      <mesh>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 20]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

const Stator = ({ active }: { active: boolean }) => {
  const coilsRef = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    if (!active) return;
    const intensity = 0.3 + Math.sin(clock.getElapsedTime() * 6) * 0.3;
    coilsRef.current.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    });
  });
  return (
    <group>
      {[...Array(8)].map((_, i) => {
        const angle = (Math.PI * 2 / 8) * i;
        return (
          <mesh
            key={i}
            ref={(el) => { if (el) coilsRef.current[i] = el; }}
            position={[Math.sin(angle) * 3.4, Math.cos(angle) * 3.4, 0]}
            rotation={[0, 0, -angle]}
          >
            <torusGeometry args={[0.55, 0.22, 16, 32]} />
            <meshStandardMaterial
              color="#b87333"
              emissive="#ffd700"
              emissiveIntensity={active ? 0.5 : 0}
              metalness={0.3} roughness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const MagneticField = ({ active }: { active: boolean }) => {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 220;
  const posRef = useRef(new Float32Array(COUNT * 3));

  useEffect(() => {
    const arr = posRef.current;
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 2;
      arr[i * 3] = Math.sin(angle) * r;
      arr[i * 3 + 1] = Math.cos(angle) * r;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
  }, []);

  useFrame((_, dt) => {
    if (!active || !ref.current) return;
    ref.current.rotation.z -= dt * 3;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8b5cf6" size={0.14} transparent opacity={active ? 0.8 : 0} />
    </points>
  );
};

const CasingRing = () => (
  <mesh rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[4.2, 4.2, 0.5, 32, 1, true]} />
    <meshStandardMaterial color="#cccccc" transparent opacity={0.18} side={THREE.DoubleSide} metalness={0.5} roughness={0.4} />
  </mesh>
);

const ACWaveform = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  const points = [...Array(200)].map((_, i) => {
    const x = (i / 199) * 220;
    const y = 20 - Math.sin((i / 199) * Math.PI * 4) * 16;
    return `${x},${y}`;
  }).join(' ');
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      style={{
        background: 'rgba(255,255,255,0.96)',
        borderRadius: '1rem',
        border: '2px solid rgba(139,92,246,0.4)',
        padding: '0.6rem 1.2rem',
        boxShadow: '0 4px 20px rgba(139,92,246,0.2)',
      }}
    >
      <p className="text-center font-display font-bold mb-1" style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>
        AC WAVEFORM — 50 Hz
      </p>
      <svg width="220" height="40" viewBox="0 0 220 40">
        <polyline
          points={points}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line x1="0" y1="20" x2="220" y2="20" stroke="rgba(139,92,246,0.3)" strokeWidth="1" strokeDasharray="4,4" />
      </svg>
    </motion.div>
  );
};

const STEPS = [
  {
    step: 0,
    title: 'Ready to Start',
    icon: '▶️',
    color: 'from-violet-600 to-purple-500',
    explanation: 'Inside the generator is a ROTOR (rotating magnet) surrounded by STATOR copper coils. When the rotor spins, it creates a changing magnetic field.',
    action: 'Click "SPIN ROTOR" to start!',
  },
  {
    step: 1,
    title: 'Rotor Spinning!',
    icon: '⚙️',
    color: 'from-blue-600 to-violet-500',
    explanation: 'The rotor is now spinning! The red and blue poles are N and S magnets. As it turns, the magnetic field lines sweep through the copper coils around it.',
    action: 'Watch the rotor spin → click Next to see the magnetic field.',
  },
  {
    step: 2,
    title: 'Magnetic Field Active!',
    icon: '🧲',
    color: 'from-purple-600 to-pink-500',
    explanation: 'Magnetic field lines (shown in purple) are rotating and cutting through the copper coils. By Faraday\'s Law: EMF = −N × dΦ/dt. A changing field induces current!',
    action: 'The field is cutting the coils → click Next to see the result.',
  },
  {
    step: 3,
    title: '⚡ AC Electricity Generated!',
    icon: '⚡',
    color: 'from-amber-500 to-yellow-400',
    explanation: 'ALTERNATING CURRENT (AC) is now flowing! The current reverses direction 50 times every second (50 Hz). This is the same AC electricity in your home!',
    action: '🎉 Generator complete! Level done!',
  },
];

export const Level2Generator = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [step, setStep] = useState(0);

  const voltMessages = [
    "Inside the Generator! 🤖 TAP 'SPIN ROTOR' to start the electromagnet spinning!",
    "⚙️ Rotor SPINNING! The electromagnet is rotating inside the copper coils!",
    "🧲 Magnetic field lines are cutting through the coils — this creates a changing FLUX!",
    "⭐ EMF induced! Alternating Current (AC) flows! Faraday's Law: EMF = −N × dΦ/dt",
  ];

  useEffect(() => {
    setVoltMessage(voltMessages[0]);
  }, []);

  const handleSpin = () => {
    if (step > 0) return;
    setStep(1);
    setVoltMessage(voltMessages[1]);
  };

  const handleNext = () => {
    if (step >= 3) return;
    const next = step + 1;
    setStep(next);
    setVoltMessage(voltMessages[next]);
    if (next === 3) {
      setLevelComplete(true);
      addScore(100);
      addStar();
    }
  };

  const currentStepData = STEPS[step];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #e8f0fe 50%, #f5f0ff 100%)' }}
      />

      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 14], fov: 55 }}
        shadows
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
        <pointLight position={[0, 0, 6]} color="#8b5cf6" intensity={step >= 3 ? 2.5 : step >= 1 ? 1.2 : 0} distance={20} />
        <pointLight position={[0, 0, -5]} color="#fbbf24" intensity={step >= 3 ? 1.5 : 0} distance={15} />
        <Environment preset="dawn" />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={22} maxPolarAngle={Math.PI / 1.5} />

        <CasingRing />
        <Rotor spinning={step >= 1} />
        <Stator active={step >= 3} />
        <MagneticField active={step >= 2} />

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 10, 16]} />
          <meshStandardMaterial color="#999999" metalness={0.8} roughness={0.2} />
        </mesh>

        {[4.8, -4.8].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[4.5, 4.5, 0.4, 32]} />
            <meshStandardMaterial color="#dddddd" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </Canvas>

      <ACWaveform visible={step >= 3} />

      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(210px, 23vw, 285px)', paddingBottom: '0.25rem' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <InfoCard title={currentStepData.title} icon={currentStepData.icon} colorClass={currentStepData.color}>
              <p className="leading-snug text-slate-700" style={{ fontSize: '0.9rem' }}>{currentStepData.explanation}</p>
              <p className="font-bold mt-2" style={{ fontSize: '0.82rem', color: '#8b5cf6' }}>{currentStepData.action}</p>
            </InfoCard>
          </motion.div>
        </AnimatePresence>

        <div className="game-panel">
          <h3 className="font-display font-bold text-slate-800 mb-3" style={{ fontSize: '0.98rem' }}>Generator Steps</h3>
          {[
            { label: '1. Rotor Rotates', done: step >= 1, icon: '⚙️' },
            { label: '2. Magnetic Field Changes', done: step >= 2, icon: '🧲' },
            { label: '3. Current in Stator Coils', done: step >= 3, icon: '🔄' },
            { label: '4. AC Waveform Produced', done: step >= 3, icon: '⚡' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 mb-2">
              <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
              <span className="font-bold flex-1" style={{ fontSize: '0.88rem', color: s.done ? '#059669' : '#94a3b8' }}>
                {s.label}
              </span>
              {s.done && <span style={{ color: '#059669' }}>✓</span>}
            </div>
          ))}
        </div>

        <div className="game-panel" style={{ background: '#fefce8', border: '2px solid #fde047' }}>
          <h4 className="font-display font-bold text-amber-700 mb-2" style={{ fontSize: '0.9rem' }}>📐 Key Formula</h4>
          <code className="block font-bold text-center text-purple-700" style={{ fontSize: '0.95rem' }}>
            EMF = −N × dΦ/dt
          </code>
          <p className="text-slate-600 mt-1" style={{ fontSize: '0.78rem' }}>
            N = coil turns, Φ = magnetic flux, t = time
          </p>
          <p className="text-slate-600 mt-1" style={{ fontSize: '0.78rem' }}>
            <strong>Rotor</strong> = rotating magnet &nbsp;|&nbsp; <strong>Stator</strong> = copper coils
          </p>
        </div>

        <AnimatePresence>
          {step === 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSpin}
              className="game-btn w-full justify-center"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                fontSize: '1.1rem',
              }}
            >
              ⚙️ SPIN ROTOR!
            </motion.button>
          )}

          {step >= 1 && step < 3 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleNext}
              className="w-full py-3 rounded-2xl font-display font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                fontSize: '1rem',
                boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
              }}
            >
              {step === 1 ? '🧲 Show Magnetic Field →' : '⚡ Generate Electricity →'}
            </motion.button>
          )}

          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="game-panel text-center"
              style={{ background: '#f0fdf4', border: '2px solid #86efac' }}
            >
              <p className="font-display text-slate-500 mb-1" style={{ fontSize: '0.75rem' }}>AC OUTPUT</p>
              <p className="text-violet-600 font-mono font-bold" style={{ fontSize: '1.8rem' }}>240V AC</p>
              <p className="text-violet-600 font-bold mt-1" style={{ fontSize: '0.85rem' }}>50 Hz Alternating Current ✓</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col gap-2">
        {[
          { label: 'STATOR', sublabel: 'Copper Coils', color: '#b87333', bg: 'rgba(184,115,51,0.12)' },
          { label: 'ROTOR', sublabel: 'Rotating Magnet', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
        ].map((item) => (
          <div key={item.label}
            className="px-3 py-1.5 rounded-xl"
            style={{ background: item.bg, border: `2px solid ${item.color}55` }}
          >
            <p className="font-display font-bold" style={{ color: item.color, fontSize: '0.85rem' }}>{item.label}</p>
            <p className="font-medium" style={{ color: '#666666', fontSize: '0.7rem' }}>{item.sublabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
