import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

const StepDownTransformer = ({ active }: { active: boolean }) => {
  const coilRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!active || !coilRef.current) return;
    const mat = coilRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(clock.getElapsedTime() * 6) * 0.25;
  });
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
        <mesh key={i} ref={i === 1 ? coilRef : undefined} position={[x * 1.4, 4.8, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 1.2, 12]} />
          <meshStandardMaterial
            color={active ? '#06b6d4' : '#aa5555'}
            emissive={active ? '#06b6d4' : '#000000'}
            emissiveIntensity={active ? 0.5 : 0}
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

const CircuitBreaker = ({ on, onClick }: { on: boolean; onClick: () => void }) => {
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
      onPointerOver={() => { if (!on) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.2, 2.5, 1.2]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={leverRef} position={[0, 1.8, 0.65]}>
        <boxGeometry args={[0.22, 1.1, 0.22]} />
        <meshStandardMaterial
          color={on ? '#22c55e' : '#ef4444'}
          emissive={on ? '#22c55e' : '#ef4444'}
          emissiveIntensity={0.6}
        />
      </mesh>
      {!on && (
        <mesh position={[0, 2.8, 0]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
};

const EnergyBolt = ({ active }: { active: boolean }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = active;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1 + Math.sin(clock.getElapsedTime() * 8) * 0.8;
  });
  return (
    <mesh ref={ref} position={[0, 7, 0]} visible={active}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1.5} />
    </mesh>
  );
};

const FLOW_STEPS = [
  {
    label: 'Transmission Line arrives at 132 kV',
    icon: '🗼',
    color: '#f59e0b',
    info: 'Electricity arrives from the transmission towers at 132,000 Volts — far too dangerous for homes.',
  },
  {
    label: 'Circuit Breaker controls flow',
    icon: '🔴',
    color: '#ef4444',
    info: 'The circuit breaker is a safety switch. Close it to allow electricity into the step-down transformer.',
  },
  {
    label: 'Step-down transformer reduces voltage',
    icon: '🏢',
    color: '#06b6d4',
    info: 'The transformer reduces 132 kV to 11 kV for city distribution. It uses fewer coil turns to drop voltage: V₁/V₂ = N₁/N₂.',
  },
  {
    label: 'City grid receives 11 kV',
    icon: '🏙️',
    color: '#10b981',
    info: 'Safe 11 kV electricity is distributed to neighbourhood transformers, which reduce it further to 230–240V for homes!',
  },
];

export const Level4Substation = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [breakerOn, setBreakerOn] = useState(false);
  const [voltage, setVoltage] = useState(132);
  const [complete, setComplete] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [flowStep, setFlowStep] = useState(0);

  useEffect(() => {
    setVoltMessage("⚡ Welcome to the SUBSTATION! TAP the RED circuit breaker to step down the voltage safely!");
  }, []);

  const handleBreaker = () => {
    if (breakerOn) return;
    setBreakerOn(true);
    setFlowStep(1);
    setVoltMessage("🔌 Breaker CLOSED! The step-down transformer is reducing 132 kV to 11 kV...");

    let v = 132;
    const interval = setInterval(() => {
      v = Math.max(11, v - 4);
      setVoltage(v);
      if (v <= 11) {
        clearInterval(interval);
        setFlowStep(3);
        setShowExplanation(true);
        setVoltMessage("⭐ Voltage safely stepped DOWN to 11 kV! The neighborhood can now receive safe electricity!");
        setComplete(true);
        setLevelComplete(true);
        addScore(100);
        addStar();
      }
    }, 80);
  };

  const voltPercent = Math.max(0, Math.min(100, ((voltage - 11) / (132 - 11)) * 100));

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #e8efff 50%, #f0faff 100%)' }} />

      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [0, 8, 18], fov: 55 }}
        shadows
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 15, 8]} intensity={0.9} castShadow />
        <pointLight position={[0, 6, 0]} color="#06b6d4" intensity={breakerOn ? 2.5 : 0} distance={20} />
        <pointLight position={[-4.5, 5, 2.5]} color="#ffd700" intensity={!breakerOn ? 1.2 : 0} distance={8} />
        <Environment preset="dawn" />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={22} maxPolarAngle={Math.PI / 2.2} />

        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#d1d5db" roughness={0.95} />
        </mesh>

        {[-6, 6].map((x, i) => (
          <mesh key={i} position={[x, 1.5, 0]}>
            <boxGeometry args={[0.1, 3, 14]} />
            <meshStandardMaterial color="#888888" metalness={0.5} transparent opacity={0.4} />
          </mesh>
        ))}

        <StepDownTransformer active={breakerOn} />
        <CircuitBreaker on={breakerOn} onClick={handleBreaker} />
        <EnergyBolt active={breakerOn && !complete} />

        <mesh position={[-3, 7.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 6, 8]} />
          <meshStandardMaterial
            color={breakerOn ? '#f59e0b' : '#666666'}
            emissive={breakerOn ? '#f59e0b' : '#000'}
            emissiveIntensity={breakerOn ? 0.7 : 0}
          />
        </mesh>

        <mesh position={[3, 5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 6, 8]} />
          <meshStandardMaterial
            color={complete ? '#00e676' : '#666666'}
            emissive={complete ? '#00e676' : '#000'}
            emissiveIntensity={complete ? 0.7 : 0}
          />
        </mesh>
      </Canvas>

      {/* Completion explanation panel */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            <motion.div
              initial={{ y: 30 }}
              animate={{ y: 0 }}
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
                <div style={{ fontSize: '3rem' }}>🏢</div>
                <h2 className="font-display font-bold text-slate-800 mt-2" style={{ fontSize: '1.4rem' }}>
                  Voltage Stepped Down!
                </h2>
              </div>

              <div className="w-full space-y-2">
                {[
                  { from: '132 kV', to: 'Arrives from transmission towers', color: '#f59e0b' },
                  { from: '11 kV', to: 'After step-down transformer', color: '#06b6d4' },
                  { from: '230 V', to: 'After street transformer → your home', color: '#10b981' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: `${item.color}18`, border: `2px solid ${item.color}44` }}>
                    <span className="font-mono font-bold" style={{ color: item.color, fontSize: '1.1rem', minWidth: 65 }}>{item.from}</span>
                    <span className="text-slate-600" style={{ fontSize: '0.85rem' }}>{item.to}</span>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 rounded-xl w-full text-center" style={{ background: '#fefce8', border: '2px solid #fde047' }}>
                <code className="font-bold text-amber-700" style={{ fontSize: '1rem' }}>V₁/V₂ = N₁/N₂</code>
                <p className="text-amber-600 mt-0.5" style={{ fontSize: '0.78rem' }}>Transformer turns ratio determines voltage step-down</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowExplanation(false)}
                className="px-8 py-3 rounded-2xl font-display font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
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

      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(210px, 23vw, 285px)', paddingBottom: '0.25rem' }}
      >
        <InfoCard title="Substation" icon="🏢" colorClass="from-cyan-700 to-cyan-500">
          <p><strong>Why Step Down?</strong> 132 kV is far too dangerous for homes — it would be lethal!</p>
          <p><strong>Transformer:</strong> V₁/V₂ = N₁/N₂ — fewer coil turns = lower output voltage.</p>
          <p><strong>Circuit Breaker:</strong> Protects the grid from overloads and short circuits.</p>
          <p><strong>After:</strong> 11 kV → street transformers → <strong>230 V</strong> for your home.</p>
        </InfoCard>

        <div className="game-panel">
          <h3 className="font-display font-bold text-slate-800 mb-2" style={{ fontSize: '1.05rem' }}>
            Voltage Meter
          </h3>
          <div className="meter-display mb-2 flex items-baseline gap-1">
            <motion.span
              key={voltage}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-mono font-bold"
              style={{ fontSize: '2rem', color: voltage > 50 ? '#ef4444' : '#06b6d4' }}
            >
              {voltage}
            </motion.span>
            <span className="font-mono font-bold text-slate-500" style={{ fontSize: '1.1rem' }}> kV</span>
          </div>

          <div className="rounded-full overflow-hidden" style={{ height: 14, background: '#e2e8f0' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${voltPercent}%`,
                background: voltage > 50
                  ? 'linear-gradient(90deg,#ef4444,#f59e0b)'
                  : 'linear-gradient(90deg,#22c55e,#06b6d4)',
              }}
              animate={{ width: `${voltPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-bold text-green-500" style={{ fontSize: '0.7rem' }}>11 kV ✓ Safe</span>
            <span className="font-bold text-red-400" style={{ fontSize: '0.7rem' }}>132 kV ⚠</span>
          </div>

          <p
            className="text-center font-bold mt-2"
            style={{ fontSize: '0.85rem', color: voltage <= 11 ? '#059669' : '#94a3b8' }}
          >
            {voltage <= 11 ? '✓ Safe for Distribution!' : `Target: 11 kV`}
          </p>
        </div>

        <div className="game-panel">
          <h3 className="font-display font-bold text-slate-700 mb-2" style={{ fontSize: '0.9rem' }}>Electricity Flow</h3>
          {FLOW_STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{s.icon}</span>
              <div className="flex-1">
                <p className="font-bold" style={{ fontSize: '0.8rem', color: flowStep >= i ? s.color : '#94a3b8' }}>{s.label}</p>
              </div>
              {flowStep >= i && <span style={{ color: s.color, fontSize: '0.9rem' }}>✓</span>}
            </div>
          ))}
        </div>

        {!breakerOn && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBreaker}
            className="game-btn w-full justify-center"
            style={{
              background: 'linear-gradient(135deg,#ffd700,#f59e0b)',
              fontSize: '1.1rem',
            }}
          >
            🔌 CLOSE THE BREAKER!
          </motion.button>
        )}
      </div>

      {!breakerOn && (
        <motion.div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none z-20"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <div
            className="px-5 py-3 rounded-full font-display font-bold text-slate-900 shadow-xl"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '1.05rem', boxShadow: '0 0 20px rgba(255,215,0,0.5)' }}
          >
            👆 TAP the RED CIRCUIT BREAKER to activate!
          </div>
        </motion.div>
      )}
    </div>
  );
};
