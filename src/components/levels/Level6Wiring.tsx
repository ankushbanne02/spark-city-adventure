import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { initBasicScene } from '../../utils/three-helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';

const ROOMS = [
  {
    id: 'hall',
    name: 'HALL',
    icon: '🛋️',
    color: '#3b82f6',
    appliances: [
      { id: 'hall_light', name: 'Hall Bulb', icon: '💡', watts: 9, type: 'light', pos: [-4, 4.7, 1] as [number,number,number] },
      { id: 'hall_fan',   name: 'Hall Fan',  icon: '🌀', watts: 70, type: 'fan',   pos: [-4, 4.65, 3] as [number,number,number] },
      { id: 'hall_tv',    name: 'Hall TV',   icon: '📺', watts: 120, type: 'tv',   pos: [-4, 2.5, -6.8] as [number,number,number] },
    ],
  },
  {
    id: 'kitchen',
    name: 'KITCHEN',
    icon: '🍳',
    color: '#f97316',
    appliances: [
      { id: 'kit_light',  name: 'Kitchen Bulb',     icon: '💡', watts: 9, type: 'light',  pos: [0, 4.7, -3.5] as [number,number,number] },
      { id: 'kit_fridge', name: 'Refrigerator',     icon: '❄️', watts: 300, type: 'fridge', pos: [0.5, 2.25, -5.5] as [number,number,number] },
      { id: 'kit_washer', name: 'Washing Machine',  icon: '🌊', watts: 500, type: 'washer', pos: [-2.5, 1.1, -5.5] as [number,number,number] },
    ],
  },
  {
    id: 'bedroom',
    name: 'BEDROOM',
    icon: '🛏️',
    color: '#8b5cf6',
    appliances: [
      { id: 'bed_light', name: 'Bedroom Bulb', icon: '💡', watts: 9, type: 'light', pos: [5, 4.7, 2.5] as [number,number,number] },
      { id: 'bed_fan',   name: 'Bedroom Fan',  icon: '🌀', watts: 70, type: 'fan',   pos: [5, 4.65, 3.5] as [number,number,number] },
      { id: 'bed_tv',    name: 'Bedroom TV',   icon: '📺', watts: 120, type: 'tv',   pos: [5, 2.4, -6.8] as [number,number,number] },
    ],
  },
];

const ALL_APPLIANCES = ROOMS.flatMap(r => r.appliances.map(a => ({ ...a, roomColor: r.color })));
const TOTAL = ALL_APPLIANCES.length;

const TIPS = [
  "⚡ Why grounding? The earth wire provides a safe path for fault current, preventing electric shock.",
  "🔴 Phase wires carry 240V — they're dangerous! Always isolate before touching any wiring.",
  "🛡️ MCB breakers trip in milliseconds when there's a short circuit, protecting you and your home.",
  "🔵 Neutral wire returns current safely back to the grid — all appliances need it!",
];

export const Level6Wiring = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const objectsRef = useRef<Record<string, any>>({});
  const lightsRef = useRef<Map<string, THREE.PointLight>>(new Map());
  const fanRef = useRef<{ hall: THREE.Group | null; bed: THREE.Group | null }>({ hall: null, bed: null });
  const completedRef = useRef(false);
  const activeRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setVoltMessage("🏠 Home Wiring! Tap each appliance in the TOOLBOX to install it. Install all 9 to complete!");
    const t = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const installAppliance = useCallback((id: string) => {
    setInstalled(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      activeRef.current = next;
      addScore(15);

      const app = ALL_APPLIANCES.find(a => a.id === id)!;
      setVoltMessage(`✅ ${app.name} INSTALLED! Drawing ${app.watts}W from MCB panel through Phase, Neutral & Earth wires.`);

      // Glow in 3D
      const scene = objectsRef.current.__scene as THREE.Scene;
      if (scene) {
        const bulb = objectsRef.current[`bulb_${id}`];
        if (bulb) {
          const mat = bulb.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0xffee44);
          mat.emissiveIntensity = 1.4;
          const pl = new THREE.PointLight(0xffeebb, 3, 12);
          pl.position.copy(bulb.position);
          scene.add(pl);
          lightsRef.current.set(id, pl);
        }
        const tvScreen = objectsRef.current[`tvScreen_${id}`];
        if (tvScreen) {
          (tvScreen.material as THREE.MeshStandardMaterial).emissive.setHex(0x1a44cc);
          (tvScreen.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5;
        }
        // Glow wire
        const wire = objectsRef.current[`wire_${id}`];
        if (wire) {
          (wire.material as THREE.MeshStandardMaterial).color.setHex(0xffd700);
          (wire.material as THREE.MeshStandardMaterial).emissive.setHex(0xffd700);
          (wire.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
        }
      }

      if (next.size === TOTAL && !completedRef.current) {
        completedRef.current = true;
        setVoltMessage("⭐ ALL appliances installed! Each runs in PARALLEL — full 240V each, protected by its own MCB breaker!");
        setLevelComplete(true);
        addStar();
      }
      return next;
    });
    setSelectedId(null);
  }, [addScore, addStar, setLevelComplete, setVoltMessage]);

  useEffect(() => {
    if (!containerRef.current) return;
    const { scene, camera, renderer, controls, cleanup } = initBasicScene(containerRef.current);
    objectsRef.current.__scene = scene;

    scene.background = new THREE.Color(0xf0f4f8);
    camera.position.set(18, 20, 18);
    controls.target.set(0, 2, 0);
    controls.maxPolarAngle = Math.PI / 2.2;

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x8fca6a, roughness: 0.9 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    scene.add(grass);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 14), new THREE.MeshStandardMaterial({ color: 0xede5d8, roughness: 0.85 }));
    floor.position.set(0, 0.12, 0);
    scene.add(floor);

    const wall = (w: number, h: number, d: number, x: number, y: number, z: number, color = 0xf8f5f0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.set(x, y, z);
      m.castShadow = true;
      scene.add(m);
    };
    wall(18, 5, 0.3, 0, 2.5, -7);
    wall(0.3, 5, 14, -9, 2.5, 0);
    wall(0.3, 5, 14, 9, 2.5, 0);
    wall(7, 5, 0.3, -5, 2.5, 0, 0xedeae6);
    wall(7, 5, 0.3, 5, 2.5, 0, 0xedeae6);

    // Room floor tints
    const roomFloor = (color: number, x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.26, z);
      scene.add(m);
    };
    roomFloor(0xe8dfd0, -4, 0, 8, 12); // hall (warm beige)
    roomFloor(0xe0e8e0, 0, -3.5, 8, 7); // kitchen (cool green-grey)
    roomFloor(0xe8e0f0, 5, 0, 8, 14); // bedroom (soft purple)

    // MCB Panel
    const mcbPanel = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.3), new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.2 }));
    mcbPanel.position.set(-8.8, 3.5, -6.8);
    scene.add(mcbPanel);
    for (let i = 0; i < 6; i++) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x22c55e : 0xf59e0b, emissive: i % 2 === 0 ? 0x22c55e : 0xf59e0b, emissiveIntensity: 0.3 }));
      br.position.set(-9.2 + i * 0.4, 3.5, -6.5);
      scene.add(br);
    }

    // Hall furniture
    const couch = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x9b6a4a }));
    couch.position.set(-4, 0.65, 4);
    scene.add(couch);
    const couchBack = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a5a3a }));
    couchBack.position.set(-4, 1.25, 4.9);
    scene.add(couchBack);

    // Hall TV
    const hallTvFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    const hallTvScreen = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    hallTvScreen.position.z = 0.02;
    const hallTvGrp = new THREE.Group();
    hallTvGrp.add(hallTvFrame, hallTvScreen);
    hallTvGrp.position.set(-4, 2.5, -6.8);
    scene.add(hallTvGrp);
    objectsRef.current['tvScreen_hall_tv'] = hallTvScreen;

    const hallBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    hallBulb.position.set(-4, 4.7, 1);
    scene.add(hallBulb);
    objectsRef.current['bulb_hall_light'] = hallBulb;

    const hallFan = new THREE.Group();
    const hallFanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x888877 }));
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.6), new THREE.MeshStandardMaterial({ color: 0xb09878 }));
      blade.position.x = 1.3;
      const piv = new THREE.Group();
      piv.rotation.y = (Math.PI / 2) * i;
      piv.add(blade);
      hallFan.add(piv);
    }
    hallFan.add(hallFanHub);
    hallFan.position.set(-4, 4.65, 3);
    scene.add(hallFan);
    objectsRef.current['fan_hall_fan'] = hallFan;
    fanRef.current.hall = hallFan;

    // Bedroom
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xd4c4a8 }));
    bedBase.position.set(5, 0.5, 2);
    scene.add(bedBase);
    const bedHead = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.3), new THREE.MeshStandardMaterial({ color: 0xb8a080 }));
    bedHead.position.set(5, 1.1, -0.2);
    scene.add(bedHead);

    const bedTvFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    const bedTvScreen = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.8, 0.26), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bedTvScreen.position.z = 0.02;
    const bedTvGrp = new THREE.Group();
    bedTvGrp.add(bedTvFrame, bedTvScreen);
    bedTvGrp.position.set(5, 2.4, -6.8);
    scene.add(bedTvGrp);
    objectsRef.current['tvScreen_bed_tv'] = bedTvScreen;

    const bedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    bedBulb.position.set(5, 4.7, 2.5);
    scene.add(bedBulb);
    objectsRef.current['bulb_bed_light'] = bedBulb;

    const bedFan = new THREE.Group();
    const bedFanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x888877 }));
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.55), new THREE.MeshStandardMaterial({ color: 0xb09878 }));
      blade.position.x = 1.2;
      const piv = new THREE.Group();
      piv.rotation.y = (Math.PI / 2) * i;
      piv.add(blade);
      bedFan.add(piv);
    }
    bedFan.add(bedFanHub);
    bedFan.position.set(5, 4.65, 3.5);
    scene.add(bedFan);
    objectsRef.current['fan_bed_fan'] = bedFan;
    fanRef.current.bed = bedFan;

    // Kitchen appliances
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(2, 4.5, 2), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.3 }));
    fridgeBody.position.set(0.5, 2.25, -5.5);
    scene.add(fridgeBody);
    const kitBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    kitBulb.position.set(0, 4.7, -3.5);
    scene.add(kitBulb);
    objectsRef.current['bulb_kit_light'] = kitBulb;
    const washerBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }));
    washerBody.position.set(-2.5, 1.1, -5.5);
    scene.add(washerBody);
    const washerDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0xaaaacc, metalness: 0.4 }));
    washerDoor.rotation.x = Math.PI / 2;
    washerDoor.position.set(-2.5, 1.2, -4.45);
    scene.add(washerDoor);

    // Wires from MCB (grey, will glow when installed)
    ALL_APPLIANCES.forEach(app => {
      const pos = new THREE.Vector3(...app.pos);
      const pts = [
        new THREE.Vector3(-8.8, 4, -6.8),
        new THREE.Vector3(-8.8, 5.2, pos.z),
        new THREE.Vector3(pos.x, 5.2, pos.z),
        pos.clone(),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const wireMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.5 });
      const wireMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.055, 6, false), wireMat);
      scene.add(wireMesh);
      objectsRef.current[`wire_${app.id}`] = wireMesh;
    });

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const act = activeRef.current;
      if (act.has('hall_fan') && fanRef.current.hall) fanRef.current.hall.rotation.y += 0.05;
      if (act.has('bed_fan') && fanRef.current.bed) fanRef.current.bed.rotation.y += 0.04;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); cleanup(); };
  }, []);

  const installedCount = installed.size;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#f0f4f8 0%,#e8eef4 100%)' }} />
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Toolbox right panel */}
      <div
        className="absolute right-0 top-0 bottom-0 z-10 flex flex-col pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(220px, 26vw, 300px)', background: 'rgba(255,255,255,0.97)', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }}
      >
        {/* Toolbox header */}
        <div className="px-4 py-3 flex items-center gap-2 font-display font-bold text-white" style={{ background: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', fontSize: '1.1rem' }}>
          🧰 Toolbox
        </div>

        <div className="flex-1 px-3 py-2">
          {ROOMS.map(room => (
            <div key={room.id} className="mb-3">
              <p className="font-bold uppercase tracking-widest mb-2 px-1" style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.1em' }}>
                {room.name}
              </p>
              <div className="flex flex-col gap-1.5">
                {room.appliances.map(app => {
                  const isInstalled = installed.has(app.id);
                  const isSelected = selectedId === app.id;
                  return (
                    <motion.button
                      key={app.id}
                      onClick={() => {
                        if (isInstalled) return;
                        if (isSelected) {
                          installAppliance(app.id);
                        } else {
                          setSelectedId(app.id);
                          setVoltMessage(`📌 Selected ${app.name} — tap again to INSTALL it in the house!`);
                        }
                      }}
                      whileHover={!isInstalled ? { scale: 1.02 } : {}}
                      whileTap={!isInstalled ? { scale: 0.98 } : {}}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all"
                      style={{
                        background: isInstalled ? '#f0fdf4' : isSelected ? `${room.color}18` : '#f8fafc',
                        border: `2px solid ${isInstalled ? '#86efac' : isSelected ? room.color : '#e2e8f0'}`,
                        cursor: isInstalled ? 'default' : 'pointer',
                        opacity: isInstalled ? 0.85 : 1,
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{app.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate" style={{ fontSize: '0.88rem', color: isInstalled ? '#059669' : isSelected ? room.color : '#334155' }}>
                          {app.name}
                        </p>
                      </div>
                      {isInstalled ? (
                        <span className="text-green-500 font-bold" style={{ fontSize: '0.85rem' }}>✓</span>
                      ) : isSelected ? (
                        <span className="font-bold" style={{ color: room.color, fontSize: '0.7rem' }}>tap to install</span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Installed counter */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-slate-700" style={{ fontSize: '0.88rem' }}>Installed</span>
            <span className="font-bold" style={{ color: installedCount === TOTAL ? '#059669' : '#3b82f6', fontSize: '1rem' }}>
              {installedCount}/{TOTAL}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: '#e2e8f0' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
              animate={{ width: `${(installedCount / TOTAL) * 100}%` }}
            />
          </div>
          {installedCount === TOTAL && (
            <p className="text-center font-bold text-green-600 mt-2" style={{ fontSize: '0.85rem' }}>🎉 All wired!</p>
          )}
        </div>
      </div>

      {/* Bottom-left education tip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-5 left-4 z-20 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.96)',
            borderRadius: '1rem',
            padding: '0.65rem 1rem',
            maxWidth: 240,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1.5px solid rgba(0,0,0,0.07)',
          }}
        >
          <p className="text-slate-700 leading-snug" style={{ fontSize: '0.8rem' }}>{TIPS[tipIndex]}</p>
        </motion.div>
      </AnimatePresence>

      {/* Hint if nothing selected */}
      {installedCount < TOTAL && !selectedId && (
        <motion.div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none z-20"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.3, repeat: Infinity }}
          style={{ right: 'clamp(220px, 26vw, 300px)', left: 0, display: 'flex', justifyContent: 'center' }}
        >
          <div
            className="px-4 py-2.5 rounded-full font-display font-bold text-slate-900"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '0.95rem', boxShadow: '0 0 18px rgba(255,215,0,0.5)' }}
          >
            👆 Tap an item in the Toolbox to install it!
          </div>
        </motion.div>
      )}
    </div>
  );
};
