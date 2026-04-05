import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { initBasicScene } from '../../utils/three-helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

const STEPS = [
  {
    title: '1. Service Pole & Cable',
    icon: '🔌',
    color: '#3b82f6',
    info: '240V AC electricity arrives from the national grid through overhead cables. The utility pole is the last connection of the distribution network before electricity enters your house.',
    voltMsg: "🔌 The SERVICE POLE brings 240V AC from the grid! Thick overhead cables carry high-current electricity to your home.",
  },
  {
    title: '2. Electric Meter',
    icon: '📊',
    color: '#8b5cf6',
    info: 'The Electric Meter counts every kilowatt-hour (kWh) you use. 1 kWh = 1000 Watts running for 1 hour. The utility reads this meter monthly to calculate your electricity bill!',
    voltMsg: "📊 The ELECTRIC METER is connected! It counts kWh. 1 kWh = 1000W for 1 hour. Every unit on your bill started here!",
  },
  {
    title: '3. Main Switch (Isolator)',
    icon: '🔴',
    color: '#ef4444',
    info: 'The Main Isolator Switch cuts ALL electricity to the house instantly. ALWAYS turn this OFF before any electrical work — it\'s your primary safety control!',
    voltMsg: "🔴 MAIN SWITCH installed! Cuts ALL power instantly. Always turn it OFF before touching any wires — safety first!",
  },
  {
    title: '4. MCB Panel (Distribution Board)',
    icon: '🛡️',
    color: '#059669',
    info: 'The MCB Panel has separate circuit breakers for each room. If a fault occurs, the MCB trips automatically in 0.01 seconds — faster than a heartbeat — preventing fires and shocks!',
    voltMsg: "🛡️ MCB PANEL installed! Each breaker protects one room. Trips in 0.01 seconds when a fault occurs!",
  },
  {
    title: '5. Three Essential Wires',
    icon: '🔴🔵🟢',
    color: '#f59e0b',
    info: 'Every circuit has 3 wires:\n• PHASE (Red): Live 240V — never touch!\n• NEUTRAL (Blue): Returns current to grid.\n• EARTH (Green): Safety — diverts fault current to ground!',
    voltMsg: "⭐ THREE WIRES complete the circuit! Phase=240V Live, Neutral=return path, Earth=safety ground!",
  },
];

const addWire = (scene: THREE.Scene, pts: THREE.Vector3[], color: number, radius = 0.07): THREE.Mesh => {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 20, radius, 7, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
};

/* Step 0: Utility pole + dim service cable */
const buildStep0 = (scene: THREE.Scene) => {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 13, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 })
  );
  pole.position.set(-10, 6.5, 0);
  scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x6a4a30 }));
  arm.position.set(-10, 11.5, 0);
  scene.add(arm);
  [-0.8, 0.8].forEach(dx => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x9090bb }));
    ins.position.set(-10 + dx, 11.3, 0);
    scene.add(ins);
  });
  // Dim unlit cable
  addWire(scene, [
    new THREE.Vector3(-10, 11.3, 0),
    new THREE.Vector3(-8.8, 9.5, -1),
    new THREE.Vector3(-8.4, 7.5, -1),
  ], 0x444444, 0.06);
};

/* Step 1: Electric Meter — on exterior left wall (x=-8.4, z=-1) */
const buildStep1 = (scene: THREE.Scene) => {
  // Dark mounting back plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.4 }));
  plate.position.set(-8.35, 3.5, -1);
  scene.add(plate);
  // White meter casing
  const casing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.0, 2.0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }));
  casing.position.set(-8.1, 3.5, -1);
  scene.add(casing);
  // LCD display window
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 1.3), new THREE.MeshStandardMaterial({ color: 0xc8f0d0, roughness: 0.2 }));
  lcd.position.set(-7.85, 3.8, -1);
  scene.add(lcd);
  // Rotating dial
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0xfafafa }));
  dial.rotation.z = Math.PI / 2;
  dial.position.set(-7.85, 3.0, -1);
  scene.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), new THREE.MeshStandardMaterial({ color: 0xcc3333 }));
  needle.position.set(-7.82, 3.0, -1);
  needle.rotation.x = Math.PI / 6;
  scene.add(needle);
  // kWh label bar (yellow strip)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 1.8), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
  strip.position.set(-7.85, 2.2, -1);
  scene.add(strip);
  // Lit cable: pole → meter
  addWire(scene, [
    new THREE.Vector3(-10, 11.3, 0),
    new THREE.Vector3(-8.8, 9.5, -1),
    new THREE.Vector3(-8.4, 7.5, -1),
    new THREE.Vector3(-8.4, 4.5, -1),
  ], 0xddaa00, 0.07);
};

/* Step 2: Main Isolator Switch — on interior left wall, further inside */
const buildStep2 = (scene: THREE.Scene) => {
  // Red casing
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 1.1), new THREE.MeshStandardMaterial({ color: 0xbb2020, roughness: 0.5 }));
  sw.position.set(-7.6, 3.5, -2.5);
  scene.add(sw);
  // Yellow lever handle
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.25), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
  lever.position.set(-7.35, 4.2, -2.5);
  scene.add(lever);
  // ON indicator
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0x22dd44 }));
  led.position.set(-7.35, 3.0, -2.5);
  scene.add(led);
  // Short wire: meter → switch
  addWire(scene, [
    new THREE.Vector3(-8.0, 3.5, -1),
    new THREE.Vector3(-7.8, 3.5, -2.5),
  ], 0xddaa00, 0.07);
};

/* Step 3: MCB Distribution Panel — on back-left wall interior */
const buildStep3 = (scene: THREE.Scene) => {
  // Main box (dark enclosure)
  const enclosure = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.0, 3.2), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.2 }));
  enclosure.position.set(-7.2, 3.8, -3.6);
  scene.add(enclosure);
  // Panel face
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.5, 2.8), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  face.position.set(-6.9, 3.8, -3.6);
  scene.add(face);
  // Label strip
  const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 2.6), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
  lbl.position.set(-6.88, 5.4, -3.6);
  scene.add(lbl);
  // MCB breakers in a row
  const cols = [0x22c55e, 0x22c55e, 0xf59e0b, 0xf59e0b, 0x3b82f6, 0x3b82f6];
  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.35), new THREE.MeshStandardMaterial({ color: cols[i] }));
    br.position.set(-6.88, 3.6, -4.1 + i * 0.45);
    scene.add(br);
  }
  // Wire: switch → MCB
  addWire(scene, [
    new THREE.Vector3(-7.6, 3.5, -2.5),
    new THREE.Vector3(-7.6, 3.5, -3.6),
    new THREE.Vector3(-7.2, 3.5, -3.6),
  ], 0xddaa00, 0.07);
};

/* Step 4: 3-Wire system — Phase, Neutral, Earth */
const buildStep4 = (scene: THREE.Scene) => {
  const wireData = [
    { col: 0xcc2222, label: 'Phase', y: 7.2 },
    { col: 0x2255cc, label: 'Neutral', y: 7.0 },
    { col: 0x229944, label: 'Earth', y: 6.8 },
  ];
  wireData.forEach(w => {
    addWire(scene, [
      new THREE.Vector3(-6.9, w.y, -3.6),
      new THREE.Vector3(-3, w.y, -3.5),
      new THREE.Vector3(0, w.y, -3.5),
      new THREE.Vector3(6, w.y, -3.5),
    ], w.col, 0.06);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshStandardMaterial({ color: w.col }));
    dot.position.set(6.3, w.y, -3.5);
    scene.add(dot);
  });
};

const BUILDERS = [buildStep0, buildStep1, buildStep2, buildStep3, buildStep4];

export const Level5House = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [step, setStep] = useState(0);
  const [showWireSummary, setShowWireSummary] = useState(false);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    setVoltMessage(STEPS[0].voltMsg);
    if (!containerRef.current) return;

    const { scene, camera, renderer, controls, cleanup } = initBasicScene(containerRef.current);
    sceneRef.current = scene;

    scene.background = new THREE.Color(0xd0eaf8);
    scene.fog = new THREE.FogExp2(0xd0eaf8, 0.012);
    camera.position.set(0, 10, 24);
    camera.fov = 52;
    camera.updateProjectionMatrix();
    controls.target.set(0, 4, 0);

    // Grass
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0x7cc05a, roughness: 0.9 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.15;
    scene.add(grass);

    // ── Modern house ──
    // Concrete floor slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 9), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.7 }));
    slab.position.set(0, 0, 0);
    scene.add(slab);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f3ee, roughness: 0.55, metalness: 0.02 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd5c8ba, roughness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8ec8e8, transparent: true, opacity: 0.35, metalness: 0.2 });

    const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat = wallMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };

    // Walls
    addBox(16, 7.5, 0.4, 0, 4.05, -4.2); // back wall
    addBox(0.4, 7.5, 9, -8, 4.05, 0);    // left wall
    addBox(0.4, 7.5, 9, 8, 4.05, 0);     // right wall
    addBox(3, 7.5, 0.35, -2.5, 4.05, -0.5, concreteMat); // interior divider L
    addBox(3, 7.5, 0.35, 3.5, 4.05, -0.5, concreteMat);  // interior divider R

    // FLAT modern roof — with slight overhang
    addBox(17.5, 0.5, 10.5, 0, 8.05, 0, new THREE.MeshStandardMaterial({ color: 0x607080, roughness: 0.5, metalness: 0.1 }));
    // Parapet walls (low walls on roof perimeter)
    addBox(17.6, 0.8, 0.25, 0, 8.7, -5.1, new THREE.MeshStandardMaterial({ color: 0x777060, roughness: 0.6 }));
    addBox(17.6, 0.8, 0.25, 0, 8.7, 5.1, new THREE.MeshStandardMaterial({ color: 0x777060, roughness: 0.6 }));

    // Large modern windows (glass)
    addBox(3.5, 2.8, 0.25, -5, 4.2, 4.4, glassMat); // front left window
    addBox(3.5, 2.8, 0.25, 3, 4.2, 4.4, glassMat);  // front right window
    // Window frames
    addBox(3.7, 3.0, 0.15, -5, 4.2, 4.3, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }));
    addBox(3.7, 3.0, 0.15, 3, 4.2, 4.3, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }));
    // Window behind glass
    addBox(3.4, 2.7, 0.25, -5, 4.2, 4.45, glassMat);
    addBox(3.4, 2.7, 0.25, 3, 4.2, 4.45, glassMat);

    // Front door
    addBox(1.8, 3.5, 0.2, 0, 2.05, 4.4, new THREE.MeshStandardMaterial({ color: 0x3b5278, roughness: 0.3, metalness: 0.3 }));
    // Door handle
    addBox(0.08, 0.08, 0.2, 0.7, 2.0, 4.55, new THREE.MeshStandardMaterial({ color: 0xddbb44, metalness: 0.9, roughness: 0.1 }));

    // Pathway
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 6), new THREE.MeshStandardMaterial({ color: 0xc0b8a0, roughness: 0.9 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, -0.12, 7.5);
    scene.add(path);

    BUILDERS[0](scene);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); cleanup(); sceneRef.current = null; };
  }, []);

  useEffect(() => {
    if (step === 0) return;
    const scene = sceneRef.current;
    if (!scene) return;
    BUILDERS[step](scene);
    setVoltMessage(STEPS[step].voltMsg);
    if (step === BUILDERS.length - 1) {
      // Don't auto-complete — show wire summary first
      setShowWireSummary(true);
      addScore(100);
      addStar();
    }
  }, [step]);

  const currentStep = STEPS[step];

  const handleComplete = () => {
    setLevelComplete(true);
  };

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(215px, 24vw, 295px)', paddingBottom: '0.25rem' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <InfoCard
              title={currentStep.title}
              icon={currentStep.icon}
              colorClass={
                step === 0 ? 'from-blue-700 to-blue-500'
                : step === 1 ? 'from-violet-700 to-violet-500'
                : step === 2 ? 'from-red-700 to-red-500'
                : step === 3 ? 'from-emerald-700 to-emerald-500'
                : 'from-amber-600 to-yellow-500'
              }
            >
              <p className="leading-snug" style={{ whiteSpace: 'pre-line' }}>{currentStep.info}</p>
            </InfoCard>
          </motion.div>
        </AnimatePresence>

        <div className="game-panel">
          <h3 className="font-display font-bold text-slate-700 mb-3" style={{ fontSize: '0.92rem' }}>
            Electricity Path
          </h3>
          <div className="flex justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-full flex items-center justify-center font-display font-bold transition-all"
                  style={{
                    width: 30, height: 30, fontSize: '0.78rem',
                    background: i < step ? '#059669' : i === step ? s.color : '#e2e8f0',
                    color: i <= step ? 'white' : '#94a3b8',
                    boxShadow: i === step ? `0 0 12px ${s.color}88` : 'none',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-lg" style={{ background: '#f8fafc' }}>
            {['🔌', '📊', '🔴', '🛡️', '⚡'].map((icon, i) => (
              <React.Fragment key={i}>
                <span style={{ fontSize: '0.95rem', opacity: i <= step ? 1 : 0.25 }}>{icon}</span>
                {i < 4 && <span style={{ fontSize: '0.7rem', color: i < step ? '#ffd700' : '#cbd5e1' }}>→</span>}
              </React.Fragment>
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setStep(s => s + 1)}
              className="w-full py-2.5 rounded-xl font-display font-bold text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${currentStep.color}, ${currentStep.color}bb)`,
                fontSize: '1rem',
                boxShadow: `0 4px 14px ${currentStep.color}44`,
              }}
            >
              Next Step ➡
            </motion.button>
          ) : (
            <div className="text-center py-2 rounded-xl font-display font-bold" style={{ background: '#f0fdf4', color: '#059669', fontSize: '0.88rem' }}>
              ⭐ All 5 steps complete!
            </div>
          )}
        </div>

        {/* Wire summary — shown on last step before level complete */}
        <AnimatePresence>
          {showWireSummary && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="game-panel"
              style={{ border: '2px solid #fbbf24' }}
            >
              <h4 className="font-display font-bold text-slate-700 mb-2" style={{ fontSize: '0.92rem' }}>
                🔴🔵🟢 3-Wire System
              </h4>
              {[
                { bg: '#fee2e2', dot: '#dc2626', text: 'PHASE — 240V Live!', sub: 'Never touch this wire!', textCol: '#991b1b' },
                { bg: '#dbeafe', dot: '#2563eb', text: 'NEUTRAL — Return Path', sub: 'Completes the circuit safely', textCol: '#1e40af' },
                { bg: '#dcfce7', dot: '#16a34a', text: 'EARTH — Safety Ground', sub: 'Diverts fault current', textCol: '#15803d' },
              ].map((w) => (
                <div key={w.text} className="flex items-start gap-2 rounded-xl px-2.5 py-2 mb-1.5" style={{ background: w.bg }}>
                  <div className="rounded-full flex-shrink-0 mt-0.5" style={{ width: 13, height: 13, background: w.dot, boxShadow: `0 0 6px ${w.dot}` }} />
                  <div>
                    <span className="font-bold" style={{ color: w.textCol, fontSize: '0.82rem' }}>{w.text}</span>
                    <p style={{ color: w.textCol, fontSize: '0.72rem', opacity: 0.75 }}>{w.sub}</p>
                  </div>
                </div>
              ))}

              <div className="px-3 py-2 rounded-xl mt-2 mb-3" style={{ background: '#fefce8', border: '1.5px solid #fde047' }}>
                <p className="font-bold text-amber-700" style={{ fontSize: '0.78rem' }}>
                  💡 Each wire runs from the MCB panel to every socket and light fitting in your home!
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleComplete}
                className="w-full py-3 rounded-xl font-display font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                  fontSize: '1rem',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                }}
              >
                🔌 Wire the House →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
