import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function voltageColor(v: number): string {
  if (v > 50) return '#ef4444';
  if (v > 11) return '#f59e0b';
  if (v > 1) return '#06b6d4';
  return '#22c55e';
}

function voltageLabel(v: number): string {
  if (v >= 1) return `${v.toFixed(v < 10 ? 1 : 0)} kV`;
  return `${Math.round(v * 1000)} V`;
}

// ─────────────────────────────────────────────
// 3-D Components
// ─────────────────────────────────────────────

const StepDownTransformer = ({ voltage, coilN2 }: { voltage: number; coilN2: number }) => {
  const coilRef = useRef<THREE.Mesh>(null!);
  const active = voltage <= 11;
  useFrame(({ clock }) => {
    if (!coilRef.current) return;
    const mat = coilRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = active
      ? 0.3 + Math.sin(clock.getElapsedTime() * 6) * 0.25
      : 0.05;
  });

  const coilColor = active ? '#06b6d4' : voltage > 50 ? '#ef4444' : '#f59e0b';

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 2, 0]} castShadow>
        <boxGeometry args={[5, 4.5, 4]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-1.5, -0.5, 0.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.1]} castShadow>
          <boxGeometry args={[0.18, 3.5, 0.12]} />
          <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {[-1, 0, 1].map((x, i) => (
        <mesh
          key={i}
          ref={i === 1 ? coilRef : undefined}
          position={[x * 1.4, 4.8, 0]}
        >
          <cylinderGeometry args={[0.22, 0.22, Math.max(0.4, 1.2 * (coilN2 / 200)), 12]} />
          <meshStandardMaterial
            color={coilColor}
            emissive={coilColor}
            emissiveIntensity={active ? 0.5 : 0.1}
          />
        </mesh>
      ))}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 5]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.9} />
      </mesh>
    </group>
  );
};

const CircuitBreaker = ({
  on,
  onClick,
  locked,
}: {
  on: boolean;
  onClick: () => void;
  locked: boolean;
}) => {
  const leverRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (!leverRef.current) return;
    const targetRot = on ? 0 : -Math.PI / 4;
    leverRef.current.rotation.x += (targetRot - leverRef.current.rotation.x) * 0.12;
  });
  return (
    <group
      position={[-4.5, 0, 2.5]}
      onClick={onClick}
      onPointerOver={() => { if (!on && !locked) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.2, 2.5, 1.2]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={leverRef} position={[0, 1.8, 0.65]}>
        <boxGeometry args={[0.22, 1.1, 0.22]} />
        <meshStandardMaterial
          color={on ? '#22c55e' : locked ? '#94a3b8' : '#ef4444'}
          emissive={on ? '#22c55e' : locked ? '#94a3b8' : '#ef4444'}
          emissiveIntensity={0.6}
        />
      </mesh>
      {!on && (
        <mesh position={[0, 2.8, 0]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial
            color={locked ? '#94a3b8' : '#ffd700'}
            emissive={locked ? '#94a3b8' : '#ffd700'}
            emissiveIntensity={locked ? 0.5 : 2}
          />
        </mesh>
      )}
    </group>
  );
};

const House = ({ voltage }: { voltage: number }) => {
  const bulbRef = useRef<THREE.PointLight>(null!);
  const houseRef = useRef<THREE.Group>(null!);
  const explosionRef = useRef<THREE.Mesh>(null!);

  const isExplosion = voltage > 50;
  const isFlicker = voltage > 11 && voltage <= 50;
  const isStable = voltage <= 11 && voltage >= 1;
  const isSafe = voltage < 1;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (bulbRef.current) {
      if (isExplosion) {
        bulbRef.current.intensity = 3 + Math.sin(t * 30) * 2.5;
        bulbRef.current.color.set('#ff2200');
      } else if (isFlicker) {
        bulbRef.current.intensity = Math.random() > 0.5 ? 1.5 : 0.2;
        bulbRef.current.color.set('#f59e0b');
      } else if (isStable) {
        bulbRef.current.intensity = 0.8 + Math.sin(t * 2) * 0.1;
        bulbRef.current.color.set('#ffe066');
      } else if (isSafe) {
        bulbRef.current.intensity = 1.2;
        bulbRef.current.color.set('#ffffff');
      } else {
        bulbRef.current.intensity = 0;
      }
    }
    if (houseRef.current && isExplosion) {
      houseRef.current.position.x = 8 + Math.sin(t * 40) * 0.06;
    } else if (houseRef.current) {
      houseRef.current.position.x = 8;
    }
    if (explosionRef.current) {
      explosionRef.current.visible = isExplosion;
      if (isExplosion) {
        (explosionRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
          1 + Math.abs(Math.sin(t * 20)) * 2;
        const s = 0.5 + Math.abs(Math.sin(t * 15)) * 0.5;
        explosionRef.current.scale.set(s, s, s);
      }
    }
  });

  return (
    <group ref={houseRef} position={[8, 0, 0]}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2.5, 2, 2.5]} />
        <meshStandardMaterial color="#f5e6c8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <coneGeometry args={[1.9, 1.2, 4]} />
        <meshStandardMaterial color="#c0392b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.5, 1.26]}>
        <boxGeometry args={[0.5, 0.9, 0.05]} />
        <meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh position={[-0.6, 1.2, 1.26]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial
          color={isStable || isSafe ? '#ffe066' : '#aaaaaa'}
          emissive={isStable || isSafe ? '#ffe066' : '#000'}
          emissiveIntensity={isStable || isSafe ? 0.8 : 0}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight ref={bulbRef} position={[0, 1.2, 0]} distance={6} />
      <mesh ref={explosionRef} position={[0, 2, 0]} visible={false}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
};

const ColoredWire = ({
  from,
  to,
  voltage,
  active,
}: {
  from: [number, number, number];
  to: [number, number, number];
  voltage: number;
  active: boolean;
}) => {
  const wireRef = useRef<THREE.Mesh>(null!);
  const col = voltageColor(voltage);

  useFrame(({ clock }) => {
    if (!wireRef.current || !active) return;
    const mat = wireRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + Math.abs(Math.sin(clock.getElapsedTime() * 4)) * 0.5;
  });

  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const angle = Math.atan2(dx, dy);

  return (
    <mesh ref={wireRef} position={mid} rotation={[0, 0, -angle]}>
      <cylinderGeometry args={[0.08, 0.08, length, 8]} />
      <meshStandardMaterial
        color={active ? col : '#666666'}
        emissive={active ? col : '#000'}
        emissiveIntensity={active ? 0.4 : 0}
      />
    </mesh>
  );
};

const EnergyBolt = ({ active, voltage }: { active: boolean; voltage: number }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const col = voltageColor(voltage);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = active;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1 + Math.sin(clock.getElapsedTime() * 8) * 0.8;
    mat.color.set(col);
    mat.emissive.set(col);
  });
  return (
    <mesh ref={ref} position={[0, 7, 0]} visible={active}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.5} />
    </mesh>
  );
};

// ─────────────────────────────────────────────
// Flow steps
// ─────────────────────────────────────────────

const FLOW_STEPS = [
  { label: 'Answer the safety question', icon: '❓', color: '#a855f7' },
  { label: 'Adjust transformer coils', icon: '🔧', color: '#f59e0b' },
  { label: 'Reduce voltage below 11 kV', icon: '📉', color: '#06b6d4' },
  { label: 'Close circuit breaker', icon: '🔴', color: '#ef4444' },
  { label: 'City grid receives safe power', icon: '🏙️', color: '#10b981' },
];

// ─────────────────────────────────────────────
// Main Level Component
// ─────────────────────────────────────────────

export const Level4Substation = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();

  const [phase, setPhase] = useState<'mcq' | 'simulation' | 'complete'>('mcq');
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);
  const [mcqFeedback, setMcqFeedback] = useState(false);

  const [voltage, setVoltage] = useState(132);
  const [coilN2, setCoilN2] = useState(200);
  const [breakerOn, setBreakerOn] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [showWarning, setShowWarning] = useState('');
  const [showExplosion, setShowExplosion] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [triedHighVoltage, setTriedHighVoltage] = useState(false);

  const coilN1 = 200;

  useEffect(() => {
    setVoltMessage('⚡ Substation: Answer the question, then control the transformer to step voltage down safely!');
  }, []);

  const handleMcqAnswer = (idx: number) => {
    setMcqSelected(idx);
    setMcqFeedback(true);
  };

  const handleEnterSimulation = () => {
    setPhase('simulation');
    setFlowStep(1);
    setVoltMessage('🔧 Adjust the transformer coils to reduce the voltage, then close the breaker!');
  };

  const handleCoilChange = (delta: number) => {
    const newN2 = Math.max(2, Math.min(200, coilN2 + delta));
    setCoilN2(newN2);
    const newVolt = parseFloat((132 * (newN2 / coilN1)).toFixed(2));
    setVoltage(newVolt);
    if (newVolt <= 11) {
      setFlowStep(s => Math.max(s, 2));
      setVoltMessage('📉 Voltage reduced! Now close the circuit breaker.');
    }
  };

  const handleSlider = (val: number) => {
    setVoltage(val);
    const newN2 = Math.round(coilN1 * (val / 132));
    setCoilN2(Math.max(2, newN2));
    if (val <= 11) setFlowStep(s => Math.max(s, 2));
  };

  const handleBreaker = () => {
    if (breakerOn) return;

    if (voltage > 11) {
      setShowWarning('⚠️ Voltage is still too high! Sending high voltage to homes will cause damage. Reduce it first!');
      if (!triedHighVoltage) {
        setTriedHighVoltage(true);
        setShowExplosion(true);
        setVoltMessage('💥 Too dangerous! Reduce voltage before closing the breaker.');
        setTimeout(() => setShowExplosion(false), 2000);
      }
      setTimeout(() => setShowWarning(''), 3000);
      return;
    }

    setBreakerOn(true);
    setFlowStep(4);
    setVoltMessage('✅ Breaker closed at safe voltage! City grid receives 11 kV!');
    setTimeout(() => {
      setShowCompletion(true);
      setLevelComplete(true);
      addScore(100);
      addStar();
    }, 1200);
  };

  const voltPercent = Math.max(0, Math.min(100, ((voltage - 0.23) / (132 - 0.23)) * 100));
  const wireColor = voltageColor(voltage);
  const isVoltageSafe = voltage <= 11;

  const sliderVolt = voltage;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg,#f0f4ff 0%,#e8efff 50%,#f0faff 100%)' }}
      />

      {/* ── 3-D Scene ── */}
      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [4, 9, 20], fov: 55 }}
        shadows
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 15, 8]} intensity={0.9} castShadow />
        <pointLight
          position={[0, 6, 0]}
          color={wireColor}
          intensity={breakerOn ? 2.5 : 0}
          distance={20}
        />
        <pointLight
          position={[-4.5, 5, 2.5]}
          color="#ffd700"
          intensity={!breakerOn ? 1.2 : 0}
          distance={8}
        />
        <Environment preset="dawn" />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={28} maxPolarAngle={Math.PI / 2.2} />

        <mesh position={[4, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 30]} />
          <meshStandardMaterial color="#d1d5db" roughness={0.95} />
        </mesh>

        {/* Input wire (from tower) */}
        <ColoredWire from={[-8, 7.5, 0]} to={[-2.5, 7.5, 0]} voltage={voltage} active={true} />
        {/* After transformer wire */}
        <ColoredWire from={[2.5, 5, 0]} to={[7, 5, 0]} voltage={voltage} active={breakerOn} />

        <StepDownTransformer voltage={voltage} coilN2={coilN2} />
        <CircuitBreaker on={breakerOn} onClick={handleBreaker} locked={!isVoltageSafe} />
        <EnergyBolt active={!breakerOn && phase === 'simulation'} voltage={voltage} />
        <House voltage={phase === 'simulation' ? (showExplosion ? 200 : breakerOn ? voltage : 0) : 0} />

        {/* Transmission tower post */}
        <mesh position={[-8, 4, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 8, 8]} />
          <meshStandardMaterial color="#888" metalness={0.5} />
        </mesh>
        <mesh position={[-8, 8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 4, 6]} />
          <meshStandardMaterial color="#888" metalness={0.5} />
        </mesh>
      </Canvas>

      {/* ── MCQ Modal ── */}
      <AnimatePresence>
        {phase === 'mcq' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(10,20,60,0.72)', backdropFilter: 'blur(3px)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="flex flex-col gap-5 rounded-3xl px-8 py-7"
              style={{
                background: '#fff',
                boxShadow: '0 10px 50px rgba(0,0,0,0.3)',
                border: '3px solid #7c3aed',
                maxWidth: 480,
                width: '92%',
              }}
            >
              <div className="text-center">
                <div style={{ fontSize: '2.8rem' }}>🧠</div>
                <h2 className="font-bold text-slate-800 mt-2" style={{ fontSize: '1.25rem' }}>
                  Safety Question
                </h2>
                <p className="text-slate-600 mt-1" style={{ fontSize: '1rem' }}>
                  What happens if <strong>132 kV</strong> is sent directly to homes?
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  'Safe for all appliances',
                  '⚡ Appliances will burn and explode',
                  'No noticeable effect',
                ].map((opt, i) => {
                  const isCorrect = i === 1;
                  const selected = mcqSelected === i;
                  let bg = '#f8fafc';
                  let border = '#e2e8f0';
                  let textColor = '#334155';
                  if (mcqFeedback && selected && isCorrect) { bg = '#dcfce7'; border = '#22c55e'; textColor = '#166534'; }
                  else if (mcqFeedback && selected && !isCorrect) { bg = '#fee2e2'; border = '#ef4444'; textColor = '#991b1b'; }
                  else if (mcqFeedback && isCorrect) { bg = '#dcfce7'; border = '#22c55e'; textColor = '#166534'; }

                  return (
                    <motion.button
                      key={i}
                      whileHover={!mcqFeedback ? { scale: 1.02, x: 4 } : {}}
                      whileTap={!mcqFeedback ? { scale: 0.98 } : {}}
                      onClick={() => !mcqFeedback && handleMcqAnswer(i)}
                      className="text-left px-4 py-3 rounded-xl font-medium transition-all"
                      style={{
                        background: bg,
                        border: `2px solid ${border}`,
                        color: textColor,
                        fontSize: '0.95rem',
                        cursor: mcqFeedback ? 'default' : 'pointer',
                      }}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                      {mcqFeedback && isCorrect && ' ✓'}
                      {mcqFeedback && selected && !isCorrect && ' ✗'}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {mcqFeedback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: mcqSelected === 1 ? '#dcfce7' : '#fff7ed',
                      border: `2px solid ${mcqSelected === 1 ? '#22c55e' : '#f59e0b'}`,
                    }}
                  >
                    {mcqSelected === 1 ? (
                      <p className="text-green-800 font-medium" style={{ fontSize: '0.9rem' }}>
                        ✅ Correct! 132 kV would instantly destroy appliances and start fires. That's why substations step it down!
                      </p>
                    ) : (
                      <p className="text-amber-800 font-medium" style={{ fontSize: '0.9rem' }}>
                        ❌ Not quite. 132 kV is ~573× higher than home voltage (230 V). It would instantly burn appliances and cause explosions!
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {mcqFeedback && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleEnterSimulation}
                  className="w-full py-3 rounded-2xl font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    fontSize: '1.05rem',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
                  }}
                >
                  {mcqSelected === 1 ? '🎮 Start the Simulation!' : '🔬 Try the Simulation Anyway →'}
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Explosion Overlay ── */}
      <AnimatePresence>
        {showExplosion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.8, 1, 0] }}
            transition={{ duration: 1.8 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(255,50,0,0.18)' }}
          >
            <div className="text-center">
              <div style={{ fontSize: '5rem' }}>💥⚡💥</div>
              <div
                className="font-bold text-white mt-2 px-6 py-3 rounded-2xl"
                style={{ background: 'rgba(220,38,38,0.9)', fontSize: '1.15rem' }}
              >
                This is why we step down voltage!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Warning Toast ── */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-40 pointer-events-none"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div
              className="px-5 py-3 rounded-2xl font-bold text-white shadow-xl"
              style={{
                background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                fontSize: '0.95rem',
                maxWidth: 360,
                textAlign: 'center',
                boxShadow: '0 0 20px rgba(220,38,38,0.5)',
              }}
            >
              {showWarning}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Completion Modal ── */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.18)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-4 px-8 py-7 rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.97)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                border: '3px solid #06b6d4',
                maxWidth: 440,
                width: '90%',
              }}
            >
              <div className="text-center">
                <div style={{ fontSize: '3rem' }}>🏢⭐</div>
                <h2 className="font-bold text-slate-800 mt-2" style={{ fontSize: '1.4rem' }}>
                  Voltage Stepped Down Successfully!
                </h2>
              </div>
              <div className="w-full space-y-2">
                {[
                  { from: '132 kV', to: 'Arrives from transmission towers', color: '#ef4444' },
                  { from: '11 kV', to: 'After substation step-down transformer', color: '#06b6d4' },
                  { from: '230 V', to: 'After street transformer → your home', color: '#10b981' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ background: `${item.color}18`, border: `2px solid ${item.color}44` }}
                  >
                    <span
                      className="font-mono font-bold"
                      style={{ color: item.color, fontSize: '1.1rem', minWidth: 65 }}
                    >
                      {item.from}
                    </span>
                    <span className="text-slate-600" style={{ fontSize: '0.85rem' }}>{item.to}</span>
                  </div>
                ))}
              </div>
              <div
                className="px-4 py-2.5 rounded-xl w-full text-center"
                style={{ background: '#fefce8', border: '2px solid #fde047' }}
              >
                <code className="font-bold text-amber-700" style={{ fontSize: '1rem' }}>
                  V₁/V₂ = N₁/N₂ = {coilN1}/{coilN2}
                </code>
                <p className="text-amber-600 mt-0.5" style={{ fontSize: '0.78rem' }}>
                  Transformer turns ratio determines voltage step-down
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCompletion(false)}
                className="px-8 py-3 rounded-2xl font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
                  fontSize: '1.05rem',
                  boxShadow: '0 4px 16px rgba(6,182,212,0.4)',
                }}
              >
                Continue →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right Panel ── */}
      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(210px, 24vw, 290px)', paddingBottom: '0.25rem' }}
      >
        <InfoCard title="Substation" icon="🏢" colorClass="from-cyan-700 to-cyan-500">
          <p><strong>Why Step Down?</strong> 132 kV is lethal for homes and destroys appliances.</p>
          <p><strong>Transformer:</strong> V₁/V₂ = N₁/N₂ — fewer secondary turns = lower output.</p>
          <p><strong>After:</strong> 11 kV → street transformers → <strong>230 V</strong> for your home.</p>
        </InfoCard>

        {/* Voltage Meter */}
        <div className="game-panel">
          <h3 className="font-bold text-slate-800 mb-1" style={{ fontSize: '1rem' }}>
            ⚡ Voltage Meter
          </h3>
          <div className="flex items-baseline gap-1 mb-2">
            <motion.span
              key={Math.round(voltage * 10)}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-mono font-bold"
              style={{ fontSize: '2rem', color: voltageColor(voltage) }}
            >
              {voltage >= 1 ? Math.round(voltage) : Math.round(voltage * 1000)}
            </motion.span>
            <span className="font-mono font-bold text-slate-500" style={{ fontSize: '1rem' }}>
              {voltage >= 1 ? 'kV' : 'V'}
            </span>
            <span
              className="ml-1 font-bold text-xs px-2 py-0.5 rounded-full"
              style={{
                background: voltage > 50 ? '#fee2e2' : voltage > 11 ? '#fff7ed' : '#dcfce7',
                color: voltage > 50 ? '#dc2626' : voltage > 11 ? '#d97706' : '#16a34a',
              }}
            >
              {voltage > 50 ? '🔴 Danger' : voltage > 11 ? '🟡 High' : '🟢 Safe'}
            </span>
          </div>
          <div className="rounded-full overflow-hidden mb-1" style={{ height: 14, background: '#e2e8f0' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${voltPercent}%`,
                background:
                  voltage > 50
                    ? 'linear-gradient(90deg,#ef4444,#f59e0b)'
                    : voltage > 11
                    ? 'linear-gradient(90deg,#f59e0b,#fde047)'
                    : 'linear-gradient(90deg,#22c55e,#06b6d4)',
              }}
              animate={{ width: `${voltPercent}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-green-500" style={{ fontSize: '0.68rem' }}>230 V ✓</span>
            <span className="font-bold text-cyan-500" style={{ fontSize: '0.68rem' }}>11 kV</span>
            <span className="font-bold text-red-400" style={{ fontSize: '0.68rem' }}>132 kV ⚠</span>
          </div>
        </div>

        {/* Voltage Slider */}
        {phase === 'simulation' && !breakerOn && (
          <div className="game-panel">
            <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.9rem' }}>
              🎛️ Voltage Control Slider
            </h3>
            <input
              type="range"
              min={0.23}
              max={132}
              step={0.23}
              value={sliderVolt}
              onChange={e => handleSlider(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: voltageColor(voltage) }}
            />
            <div className="flex justify-between mt-1">
              <button
                className="text-xs px-2 py-1 rounded-lg font-bold"
                style={{ background: '#dcfce7', color: '#166534', border: '1.5px solid #22c55e' }}
                onClick={() => handleSlider(0.23)}
              >
                230 V
              </button>
              <button
                className="text-xs px-2 py-1 rounded-lg font-bold"
                style={{ background: '#dbeafe', color: '#1e40af', border: '1.5px solid #06b6d4' }}
                onClick={() => handleSlider(11)}
              >
                11 kV
              </button>
              <button
                className="text-xs px-2 py-1 rounded-lg font-bold"
                style={{ background: '#fee2e2', color: '#991b1b', border: '1.5px solid #ef4444' }}
                onClick={() => handleSlider(132)}
              >
                132 kV
              </button>
            </div>
          </div>
        )}

        {/* Transformer Coil Turns */}
        {phase === 'simulation' && !breakerOn && (
          <div className="game-panel">
            <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.9rem' }}>
              🔧 Transformer Coil Turns
            </h3>
            <div
              className="rounded-lg px-3 py-2 mb-2 text-center"
              style={{ background: '#fefce8', border: '2px solid #fde047' }}
            >
              <code className="font-bold text-amber-700" style={{ fontSize: '0.9rem' }}>
                V₁/V₂ = N₁/N₂
              </code>
              <br />
              <code className="text-amber-600" style={{ fontSize: '0.82rem' }}>
                132/{Math.round(132 * (voltage / 132))} = {coilN1}/{coilN2}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-center flex-1">
                <p className="text-xs text-slate-500 mb-1">Primary (N₁)</p>
                <div
                  className="font-mono font-bold rounded-lg py-1"
                  style={{ background: '#f1f5f9', fontSize: '1.1rem', color: '#475569' }}
                >
                  {coilN1}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Fixed</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-slate-500 mb-1">Secondary (N₂)</p>
                <div className="flex items-center gap-1 justify-center">
                  <button
                    onClick={() => handleCoilChange(-10)}
                    className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center"
                    style={{ background: '#ef4444', fontSize: '1.1rem' }}
                  >
                    −
                  </button>
                  <div
                    className="font-mono font-bold rounded-lg py-1 px-2"
                    style={{ background: '#f1f5f9', fontSize: '1.1rem', color: voltageColor(voltage), minWidth: 38, textAlign: 'center' }}
                  >
                    {coilN2}
                  </div>
                  <button
                    onClick={() => handleCoilChange(10)}
                    className="w-7 h-7 rounded-lg font-bold text-white flex items-center justify-center"
                    style={{ background: '#22c55e', fontSize: '1.1rem' }}
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Adjust turns</p>
              </div>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: '#64748b' }}>
              ↓ Fewer secondary turns = lower output voltage
            </p>
          </div>
        )}

        {/* Breaker button */}
        {phase === 'simulation' && !breakerOn && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleBreaker}
            className="game-btn w-full justify-center font-bold"
            style={{
              background: isVoltageSafe
                ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                : 'linear-gradient(135deg,#94a3b8,#64748b)',
              fontSize: '1rem',
              opacity: isVoltageSafe ? 1 : 0.75,
            }}
          >
            {isVoltageSafe ? '🔌 Close the Breaker!' : '🔒 Reduce Voltage First'}
          </motion.button>
        )}

        {breakerOn && (
          <div
            className="game-panel text-center"
            style={{ border: '2px solid #22c55e', background: '#dcfce7' }}
          >
            <div style={{ fontSize: '2rem' }}>✅</div>
            <p className="font-bold text-green-700" style={{ fontSize: '0.95rem' }}>
              Breaker closed! Safe power flowing!
            </p>
          </div>
        )}

        {/* Flow Steps */}
        <div className="game-panel">
          <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.88rem' }}>
            Mission Steps
          </h3>
          {FLOW_STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <span style={{ fontSize: '1rem', lineHeight: 1.4 }}>{s.icon}</span>
              <p
                className="font-medium flex-1"
                style={{
                  fontSize: '0.78rem',
                  color: flowStep > i ? s.color : flowStep === i ? '#334155' : '#94a3b8',
                }}
              >
                {s.label}
              </p>
              {flowStep > i && <span style={{ color: s.color, fontSize: '0.85rem' }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bounce hint (only before first interaction in simulation) ── */}
      {phase === 'simulation' && !breakerOn && voltage === 132 && (
        <motion.div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none z-20"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <div
            className="px-5 py-3 rounded-full font-bold text-slate-900 shadow-xl"
            style={{
              background: 'linear-gradient(135deg,#ffd700,#f59e0b)',
              fontSize: '0.95rem',
              boxShadow: '0 0 20px rgba(255,215,0,0.5)',
            }}
          >
            🎛️ Use the slider or coil turns to reduce voltage!
          </div>
        </motion.div>
      )}
    </div>
  );
};
