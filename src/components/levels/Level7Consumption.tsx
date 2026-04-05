import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { initBasicScene } from '../../utils/three-helpers';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';

const ROOMS = [
  {
    id: 'hall',
    name: 'Hall',
    icon: '🛋',
    color: '#3b82f6',
    appliances: [
      { id: 'hall_bulb', name: 'Bulb',        icon: '💡', watts: 9,   type: 'light', pos: [-4, 4.7, 1]   as [number,number,number] },
      { id: 'hall_fan',  name: 'Ceiling Fan', icon: '🌀', watts: 70,  type: 'fan',   pos: [-4, 4.65, 3]  as [number,number,number] },
      { id: 'hall_tv',   name: 'TV',          icon: '📺', watts: 120, type: 'tv',    pos: [-4, 2.5, -6.8] as [number,number,number] },
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: '🍳',
    color: '#f97316',
    appliances: [
      { id: 'kit_bulb',   name: 'Bulb',            icon: '💡', watts: 9,   type: 'light',  pos: [0, 4.7, -3.5]  as [number,number,number] },
      { id: 'kit_fridge', name: 'Refrigerator',    icon: '❄️', watts: 300, type: 'fridge', pos: [0.5, 2.25, -5.5] as [number,number,number] },
      { id: 'kit_washer', name: 'Washing Machine', icon: '🌊', watts: 500, type: 'washer', pos: [-2.5, 1.1, -5.5] as [number,number,number] },
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    icon: '🛏',
    color: '#8b5cf6',
    appliances: [
      { id: 'bed_bulb', name: 'Bulb',        icon: '💡', watts: 9,   type: 'light', pos: [5, 4.7, 2.5]  as [number,number,number] },
      { id: 'bed_fan',  name: 'Ceiling Fan', icon: '🌀', watts: 70,  type: 'fan',   pos: [5, 4.65, 3.5] as [number,number,number] },
      { id: 'bed_tv',   name: 'TV',          icon: '📺', watts: 120, type: 'tv',    pos: [5, 2.4, -6.8]  as [number,number,number] },
    ],
  },
];

const ALL = ROOMS.flatMap(r => r.appliances);
const TOTAL = ALL.length;
const TARGET_KWH = 0.5;

export const Level7Consumption = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const [kwh, setKwh] = useState(0);
  const objectsRef = useRef<Record<string, any>>({});
  const lightsRef = useRef<Map<string, THREE.PointLight>>(new Map());
  const fanRefs = useRef<{ hall: THREE.Group | null; bed: THREE.Group | null }>({ hall: null, bed: null });
  const completedRef = useRef(false);
  const activeRef = useRef<Record<string, boolean>>({});

  const totalWatts = Object.entries(switchStates)
    .filter(([, on]) => on)
    .reduce((sum, [id]) => {
      const app = ALL.find(a => a.id === id);
      return app ? sum + app.watts : sum;
    }, 0);

  const onCount = Object.values(switchStates).filter(Boolean).length;

  // kWh accumulator — ticks up based on active watts
  useEffect(() => {
    const interval = setInterval(() => {
      if (totalWatts > 0) {
        setKwh(k => {
          const next = parseFloat((k + (totalWatts / 1000) / 3600 * 2).toFixed(4));
          if (next >= TARGET_KWH && !completedRef.current) {
            completedRef.current = true;
            setLevelComplete(true);
            addStar();
            setVoltMessage('⭐ You used ' + next.toFixed(3) + ' kWh! Great job learning about power consumption!');
          }
          return next;
        });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [totalWatts]);

  const toggle = useCallback((id: string) => {
    setSwitchStates(prev => {
      const next = { ...prev, [id]: !prev[id] };
      activeRef.current = next;
      const app = ALL.find(a => a.id === id)!;
      if (next[id]) {
        addScore(10);
        setVoltMessage(`💡 ${app.name} is ON! Drawing ${app.watts}W. Watch the kWh meter climb!`);
      } else {
        setVoltMessage(`📴 ${app.name} OFF — saving ${app.watts}W!`);
      }

      // Update 3D
      const scene = objectsRef.current.__scene as THREE.Scene;
      if (scene) {
        const bulb = objectsRef.current[`bulb_${id}`];
        if (bulb) {
          const mat = bulb.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(next[id] ? 0xffee44 : 0x000000);
          mat.emissiveIntensity = next[id] ? 1.4 : 0;
          const lightKey = `pl_${id}`;
          if (next[id] && !lightsRef.current.has(lightKey)) {
            const pl = new THREE.PointLight(0xffeebb, 2.5, 12);
            pl.position.copy(bulb.position);
            scene.add(pl);
            lightsRef.current.set(lightKey, pl);
          } else if (!next[id] && lightsRef.current.has(lightKey)) {
            scene.remove(lightsRef.current.get(lightKey)!);
            lightsRef.current.delete(lightKey);
          }
        }
        const tvScreen = objectsRef.current[`tvScreen_${id}`];
        if (tvScreen) {
          (tvScreen.material as THREE.MeshStandardMaterial).emissive.setHex(next[id] ? 0x1a44cc : 0x000000);
          (tvScreen.material as THREE.MeshStandardMaterial).emissiveIntensity = next[id] ? 1.4 : 0;
        }
      }
      return next;
    });
  }, [addScore, setVoltMessage]);

  useEffect(() => {
    setVoltMessage("⚡ Toggle appliances ON to see how much power each uses. Watch the energy meter count up!");
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

    // Room floors
    const rf = (color: number, x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.26, z);
      scene.add(m);
    };
    rf(0xe8dfd0, -4, 0, 8, 12);
    rf(0xe0e8e0, 0, -3.5, 8, 7);
    rf(0xe8e0f0, 5, 0, 8, 14);

    // Hall
    const couch = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x9b6a4a }));
    couch.position.set(-4, 0.65, 4);
    scene.add(couch);
    const couchBack = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a5a3a }));
    couchBack.position.set(-4, 1.25, 4.9);
    scene.add(couchBack);

    const hallBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    hallBulb.position.set(-4, 4.7, 1);
    scene.add(hallBulb);
    objectsRef.current['bulb_hall_bulb'] = hallBulb;

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
    fanRefs.current.hall = hallFan;

    const hallTvFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    const hallTvScreen = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.26), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    hallTvScreen.position.z = 0.02;
    const hallTvGrp = new THREE.Group();
    hallTvGrp.add(hallTvFrame, hallTvScreen);
    hallTvGrp.position.set(-4, 2.5, -6.8);
    scene.add(hallTvGrp);
    objectsRef.current['tvScreen_hall_tv'] = hallTvScreen;

    // Bedroom
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xd4c4a8 }));
    bedBase.position.set(5, 0.5, 2);
    scene.add(bedBase);
    const bedHead = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.3), new THREE.MeshStandardMaterial({ color: 0xb8a080 }));
    bedHead.position.set(5, 1.1, -0.2);
    scene.add(bedHead);

    const bedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    bedBulb.position.set(5, 4.7, 2.5);
    scene.add(bedBulb);
    objectsRef.current['bulb_bed_bulb'] = bedBulb;

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
    fanRefs.current.bed = bedFan;

    const bedTvFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    const bedTvScreen = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.8, 0.26), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bedTvScreen.position.z = 0.02;
    const bedTvGrp = new THREE.Group();
    bedTvGrp.add(bedTvFrame, bedTvScreen);
    bedTvGrp.position.set(5, 2.4, -6.8);
    scene.add(bedTvGrp);
    objectsRef.current['tvScreen_bed_tv'] = bedTvScreen;

    // Kitchen
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(2, 4.5, 2), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.3 }));
    fridgeBody.position.set(0.5, 2.25, -5.5);
    scene.add(fridgeBody);
    const kitBulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xccccaa }));
    kitBulb.position.set(0, 4.7, -3.5);
    scene.add(kitBulb);
    objectsRef.current['bulb_kit_bulb'] = kitBulb;
    const washerBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }));
    washerBody.position.set(-2.5, 1.1, -5.5);
    scene.add(washerBody);
    const washerDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0xaaaacc, metalness: 0.4 }));
    washerDoor.rotation.x = Math.PI / 2;
    washerDoor.position.set(-2.5, 1.2, -4.45);
    scene.add(washerDoor);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const act = activeRef.current;
      if (act['hall_fan'] && fanRefs.current.hall) fanRefs.current.hall.rotation.y += 0.05;
      if (act['bed_fan'] && fanRefs.current.bed) fanRefs.current.bed.rotation.y += 0.04;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(frameId); cleanup(); };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#f0f4f8 0%,#e8eef4 100%)' }} />
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Right panel — narrow, scrollable */}
      <div
        className="absolute right-0 top-0 bottom-0 z-10 flex flex-col pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(200px, 25vw, 280px)', background: 'rgba(255,255,255,0.97)', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }}
      >
        {/* Volt tip bar */}
        <div className="px-3 py-2 flex items-start gap-2" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9', minHeight: 52 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.85rem' }}>
            🤖
          </div>
          <p style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4 }}>
            Toggle appliances ON to see how much power each uses. Watch the energy meter count up.
          </p>
        </div>

        <div className="px-3 py-3 flex flex-col gap-3">
          {/* Energy Meter */}
          <div className="rounded-2xl p-3" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ fontSize: '0.85rem' }}>🔄</span>
              <span className="font-bold text-slate-600" style={{ fontSize: '0.82rem' }}>Energy Meter</span>
            </div>
            <motion.div
              key={Math.floor(kwh * 1000)}
              className="font-mono font-bold"
              style={{ fontSize: '2rem', color: '#0f172a', letterSpacing: '-0.02em' }}
            >
              {kwh.toFixed(3)} <span style={{ fontSize: '1rem', color: '#64748b' }}>kWh</span>
            </motion.div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span style={{ fontSize: '0.75rem' }}>⚡</span>
              <span className="font-bold" style={{ fontSize: '0.78rem', color: totalWatts > 0 ? '#f59e0b' : '#94a3b8' }}>
                {totalWatts}W total
              </span>
            </div>
            {/* Progress to goal */}
            <div className="mt-2 rounded-full overflow-hidden" style={{ height: 5, background: '#e2e8f0' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4)' }}
                animate={{ width: `${Math.min((kwh / TARGET_KWH) * 100, 100)}%` }}
              />
            </div>
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Goal: {TARGET_KWH} kWh — {Math.min(Math.round((kwh / TARGET_KWH) * 100), 100)}% complete
            </p>
          </div>

          {/* Room sections */}
          {ROOMS.map(room => (
            <div key={room.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: '0.9rem' }}>{room.icon}</span>
                <span className="font-bold text-slate-700" style={{ fontSize: '0.88rem' }}>{room.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                {room.appliances.map(app => {
                  const on = switchStates[app.id] ?? false;
                  return (
                    <div
                      key={app.id}
                      className="flex items-center justify-between px-2.5 py-2 rounded-xl"
                      style={{ background: on ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${on ? '#86efac' : '#e2e8f0'}` }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '1.1rem' }}>{app.icon}</span>
                        <div>
                          <p className="font-bold" style={{ fontSize: '0.82rem', color: '#334155' }}>{app.name}</p>
                          <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{app.watts}W</p>
                        </div>
                      </div>
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggle(app.id)}
                        className="relative flex-shrink-0 transition-all"
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 11,
                          background: on ? '#22c55e' : '#d1d5db',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <motion.div
                          animate={{ x: on ? 17 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{
                            position: 'absolute',
                            top: 2,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: 'white',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Stats summary */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd' }}>
            <p className="font-bold text-blue-700 mb-1" style={{ fontSize: '0.8rem' }}>💡 Did You Know?</p>
            <p style={{ fontSize: '0.73rem', color: '#0369a1', lineHeight: 1.4 }}>
              {onCount === 0 ? 'Turn on appliances to learn about their energy use!'
               : onCount < 3 ? `${onCount} appliance${onCount > 1 ? 's' : ''} active. Running for 1 hour = ${(totalWatts / 1000).toFixed(3)} kWh.`
               : `${onCount} appliances use ${totalWatts}W = ${(totalWatts * 24 / 1000).toFixed(1)} kWh per day!`}
            </p>
          </div>
        </div>
      </div>

      {/* Hint */}
      {onCount < 3 && (
        <motion.div
          className="absolute bottom-5 z-20 pointer-events-none"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.3, repeat: Infinity }}
          style={{ left: 0, right: 'clamp(200px,25vw,280px)', display: 'flex', justifyContent: 'center' }}
        >
          <div
            className="px-4 py-2.5 rounded-full font-display font-bold text-slate-900"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f59e0b)', fontSize: '0.95rem', boxShadow: '0 0 18px rgba(255,215,0,0.5)' }}
          >
            ⚡ Toggle switches to turn appliances ON!
          </div>
        </motion.div>
      )}
    </div>
  );
};
