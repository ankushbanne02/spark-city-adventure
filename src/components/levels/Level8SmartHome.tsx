import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { initBasicScene } from '../../utils/three-helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';

/* ── Appliance layout — keyed by room ── */
const ROOMS = [
  {
    id: 'hall',
    name: 'Living Room',
    icon: '🛋️',
    color: '#3b82f6',
    center: [-5, 0, -4],
    appliances: [
      { id: 'hall_bulb', name: 'Ceiling Light', icon: '💡', watts: 9, type: 'light', pos: [-5, 3.5, -4] as [number, number, number] },
      { id: 'hall_fan', name: 'Ceiling Fan', icon: '🌀', watts: 70, type: 'fan', pos: [-5, 3.2, -4] as [number, number, number] },
      { id: 'hall_tv', name: 'Television', icon: '📺', watts: 120, type: 'tv', pos: [-7, 1, -7.5] as [number, number, number] },
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: '🍳',
    color: '#f97316',
    center: [5, 0, -4],
    appliances: [
      { id: 'kit_bulb', name: 'Ceiling Light', icon: '💡', watts: 9, type: 'light', pos: [5, 3.5, -4] as [number, number, number] },
      { id: 'kit_fridge', name: 'Refrigerator', icon: '❄️', watts: 300, type: 'fridge', pos: [8.5, 1.5, -7] as [number, number, number] },
      { id: 'kit_washer', name: 'Washing Machine', icon: '🌊', watts: 500, type: 'washer', pos: [3, 1, -7.5] as [number, number, number] },
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    icon: '🛏️',
    color: '#8b5cf6',
    center: [0, 0, 3],
    appliances: [
      { id: 'bed_bulb', name: 'Ceiling Light', icon: '💡', watts: 9, type: 'light', pos: [0, 3.5, 3] as [number, number, number] },
      { id: 'bed_fan', name: 'Ceiling Fan', icon: '🌀', watts: 70, type: 'fan', pos: [0, 3.2, 3] as [number, number, number] },
      { id: 'bed_tv', name: 'Television', icon: '📺', watts: 120, type: 'tv', pos: [-2.5, 1, 6.5] as [number, number, number] },
    ],
  },
];

const ALL_APPLIANCES = ROOMS.flatMap(r => r.appliances);

const buildScene = (scene: THREE.Scene) => {
  /* ── Grass ── */
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 50),
    new THREE.MeshStandardMaterial({ color: 0x6ab04c, roughness: 0.9 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.05;
  grass.receiveShadow = true;
  scene.add(grass);

  /* ── Floor ── */
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0xd4c5a9, roughness: 0.8 })
  );
  floor.position.set(0, 0.15, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  /* ── Outer walls (no roof — open-top house) ── */
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.7 });
  const wallH = 4.2;

  const walls = [
    { w: 20.4, h: wallH, d: 0.4, x: 0, z: -8.2 },   // back
    { w: 20.4, h: wallH, d: 0.4, x: 0, z: 8.2 },    // front
    { w: 0.4, h: wallH, d: 16.4, x: -10.2, z: 0 },  // left
    { w: 0.4, h: wallH, d: 16.4, x: 10.2, z: 0 },   // right
  ];
  walls.forEach(({ w, h, d, x, z }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2 + 0.3, z);
    m.castShadow = true;
    scene.add(m);
  });

  /* ── Room dividers ── */
  const divMat = new THREE.MeshStandardMaterial({ color: 0xddccbb, roughness: 0.7 });
  [
    { w: 0.3, d: 7.5, x: 0, z: -4.25 },
    { w: 7.2, d: 0.3, x: -1.5, z: -0.5 },
    { w: 7.2, d: 0.3, x: 6.5, z: -0.5 },
  ].forEach(({ w, d, x, z }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), divMat);
    m.position.set(x, wallH / 2 + 0.3, z);
    m.castShadow = true;
    scene.add(m);
  });

  /* ── Service pole (outside, left) ── */
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })
  );
  pole.position.set(-16, 6, 0);
  scene.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20 })
  );
  arm.position.set(-16, 11, 0);
  scene.add(arm);

  /* ── Service wire ── */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-16, 11, 0),
    new THREE.Vector3(-13, 10.2, 0),
    new THREE.Vector3(-10.5, 9.5, 0),
  ]);
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 20, 0.05, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  ));

  /* ── Meter box (on left wall) ── */
  const meter = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1.4, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.3 })
  );
  meter.position.set(-10.3, 2.8, 0);
  scene.add(meter);

  /* ── MCB panel (inside, on left wall) ── */
  const mcb = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.2 })
  );
  mcb.position.set(-9.5, 2.8, 0);
  scene.add(mcb);
  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.55, 0.3),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x22c55e : 0xf59e0b,
        emissive: i % 2 === 0 ? 0x22c55e : 0xf59e0b,
        emissiveIntensity: 0.3,
      })
    );
    br.position.set(-9.5 + (i % 3) * 0.38 - 0.38, 2.8 + (i < 3 ? 0.5 : -0.5), -0.1);
    scene.add(br);
  }

  /* ── Bedroom furniture suggestion ── */
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.5, 2.5),
    new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.9 })
  );
  bed.position.set(3, 0.55, 5);
  scene.add(bed);

  /* ── Hall sofa ── */
  const sofa = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.8, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.95 })
  );
  sofa.position.set(-5, 0.7, -2.5);
  scene.add(sofa);

  /* ── Kitchen counter ── */
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.7 })
  );
  counter.position.set(5.5, 0.8, -6.5);
  scene.add(counter);
};

const buildAppliance = (
  scene: THREE.Scene,
  app: (typeof ALL_APPLIANCES)[0],
  on: boolean,
  objects: Record<string, any>
) => {
  /* ── Ceiling light bulb ── */
  if (app.type === 'light') {
    const [x, y, z] = app.pos;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({
        color: on ? 0xffee44 : 0x888855,
        emissive: 0xffee44,
        emissiveIntensity: on ? 2.5 : 0,
      })
    );
    bulb.position.set(x, y, z);
    scene.add(bulb);
    objects[app.id + '_mesh'] = bulb;

    const pl = new THREE.PointLight(0xffee44, on ? 2.5 : 0, 7);
    pl.position.set(x, y - 0.4, z);
    scene.add(pl);
    objects[app.id + '_light'] = pl;

    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
    );
    fixture.position.set(x, y + 0.28, z);
    scene.add(fixture);
  }

  /* ── Fan ── */
  if (app.type === 'fan') {
    const [x, y, z] = app.pos;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
    );
    hub.position.set(x, y, z);
    scene.add(hub);

    const fanGrp = new THREE.Group();
    fanGrp.position.set(x, y, z);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.08, 0.36),
        new THREE.MeshStandardMaterial({ color: 0xbbaa99, roughness: 0.6 })
      );
      blade.position.set(0.7, 0, 0);
      blade.rotation.y = (Math.PI / 2) * i;
      blade.position.set(Math.cos((Math.PI / 2) * i) * 0.7, 0, Math.sin((Math.PI / 2) * i) * 0.7);
      fanGrp.add(blade);
    }
    scene.add(fanGrp);
    objects[app.id + '_fan'] = fanGrp;
  }

  /* ── TV ── */
  if (app.type === 'tv') {
    const [x, y, z] = app.pos;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5 })
    );
    body.position.set(x, y, z);
    scene.add(body);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.22, 0.05),
      new THREE.MeshStandardMaterial({
        color: on ? 0x1a44cc : 0x111111,
        emissive: 0x1a44cc,
        emissiveIntensity: on ? 1.8 : 0,
      })
    );
    screen.position.set(x, y, z + 0.1);
    scene.add(screen);
    objects[app.id + '_screen'] = screen;
    objects[app.id + '_body'] = body;
  }

  /* ── Fridge ── */
  if (app.type === 'fridge') {
    const [x, y, z] = app.pos;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 3.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 })
    );
    box.position.set(x, y, z);
    scene.add(box);
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.3, 0.15),
      new THREE.MeshStandardMaterial({
        color: on ? 0x00ffff : 0x111111,
        emissive: 0x00ffff,
        emissiveIntensity: on ? 1.5 : 0,
      })
    );
    inner.position.set(x, y + 0.4, z + 0.72);
    scene.add(inner);
    objects[app.id + '_screen'] = inner;
  }

  /* ── Washer ── */
  if (app.type === 'washer') {
    const [x, y, z] = app.pos;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 })
    );
    body.position.set(x, y, z);
    scene.add(body);
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.2, 20),
      new THREE.MeshStandardMaterial({
        color: on ? 0x2563eb : 0x888888,
        emissive: 0x2563eb,
        emissiveIntensity: on ? 1.2 : 0,
        metalness: 0.5,
      })
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(x, y + 0.2, z + 0.72);
    scene.add(drum);
    objects[app.id + '_drum'] = drum;
  }
};

/* ── Glowing wire strip ── */
const buildWire = (scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3, on: boolean, id: string, objects: Record<string, any>) => {
  const curve = new THREE.LineCurve3(from, to);
  const geo = new THREE.TubeGeometry(curve, 4, 0.05, 6, false);
  const mat = new THREE.MeshStandardMaterial({
    color: on ? 0xffdd00 : 0x333333,
    emissive: 0xffdd00,
    emissiveIntensity: on ? 1.5 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  objects['wire_' + id] = mesh;
};

/* ── Component ── */
export const Level8SmartHome = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const objectsRef = useRef<Record<string, any>>({});
  const sceneRef = useRef<THREE.Scene | null>(null);
  const completedRef = useRef(false);
  const animRef = useRef<number>(0);

  const allCount = ALL_APPLIANCES.length;
  const onCount = Object.values(switchStates).filter(Boolean).length;

  const totalWatts = Object.entries(switchStates)
    .filter(([, on]) => on)
    .reduce((sum, [id]) => {
      const app = ALL_APPLIANCES.find(a => a.id === id);
      return app ? sum + app.watts : sum;
    }, 0);

  /* ── Scene init ── */
  useEffect(() => {
    setVoltMessage("🏠 Welcome to your SMART HOME! Toggle each appliance switch to power the house. Watch electricity flow from the pole → meter → MCB → appliances!");

    if (!containerRef.current) return;

    const { scene, camera, renderer, controls, cleanup } = initBasicScene(containerRef.current);
    sceneRef.current = scene;

    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.014);
    camera.position.set(0, 22, 20);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    controls.target.set(0, 2, 0);
    controls.maxPolarAngle = Math.PI / 2.1;

    buildScene(scene);

    const objects = objectsRef.current;

    /* Build all appliances (initially off) */
    ALL_APPLIANCES.forEach(app => buildAppliance(scene, app, false, objects));

    /* Wires from MCB → each room center */
    buildWire(scene, new THREE.Vector3(-9, 2.5, 0), new THREE.Vector3(-6, 2.5, -4), false, 'hall', objects);
    buildWire(scene, new THREE.Vector3(-9, 2.5, 0), new THREE.Vector3(3, 2.5, -4), false, 'kitchen', objects);
    buildWire(scene, new THREE.Vector3(-9, 2.5, 0), new THREE.Vector3(-1, 2.5, 3), false, 'bedroom', objects);

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      /* Spin fans */
      ALL_APPLIANCES.filter(a => a.type === 'fan').forEach(a => {
        const grp = objects[a.id + '_fan'];
        const active = (objects._switches || {})[a.id];
        if (grp && active) grp.rotation.y += 0.08;
      });
      /* Pulse washer */
      ALL_APPLIANCES.filter(a => a.type === 'washer').forEach(a => {
        const drum = objects[a.id + '_drum'];
        const active = (objects._switches || {})[a.id];
        if (drum && active) drum.rotation.z = Math.sin(Date.now() * 0.005) * 0.15;
      });
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      cleanup();
      sceneRef.current = null;
    };
  }, []);

  /* ── React to switch changes ── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const objects = objectsRef.current;
    objects._switches = switchStates;

    /* Update appliance visuals */
    ALL_APPLIANCES.forEach(app => {
      const on = !!switchStates[app.id];

      if (app.type === 'light') {
        const mesh = objects[app.id + '_mesh'];
        const light = objects[app.id + '_light'];
        if (mesh) (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.5 : 0;
        if (light) light.intensity = on ? 2.5 : 0;
      }
      if (app.type === 'tv') {
        const scr = objects[app.id + '_screen'];
        if (scr) (scr.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.8 : 0;
      }
      if (app.type === 'fridge') {
        const scr = objects[app.id + '_screen'];
        if (scr) (scr.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.5 : 0;
      }
      if (app.type === 'washer') {
        const drum = objects[app.id + '_drum'];
        if (drum) (drum.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.2 : 0;
      }
    });

    /* Update room wires */
    ROOMS.forEach(room => {
      const anyOn = room.appliances.some(a => !!switchStates[a.id]);
      const wire = objects['wire_' + room.id];
      if (wire) {
        (wire.material as THREE.MeshStandardMaterial).emissiveIntensity = anyOn ? 1.5 : 0;
        (wire.material as THREE.MeshStandardMaterial).color.set(anyOn ? 0xffdd00 : 0x333333);
      }
    });

    const onCountNow = Object.values(switchStates).filter(Boolean).length;
    if (onCountNow === allCount && !completedRef.current) {
      completedRef.current = true;
      setVoltMessage("🎉 ALL APPLIANCES ON! Spark City is fully powered! Every appliance runs in PARALLEL — each gets 240V independently through its own MCB circuit breaker!");
      setLevelComplete(true);
      addScore(150);
      addStar();
    } else if (onCountNow > 0) {
      setVoltMessage(`⚡ ${onCountNow}/${allCount} appliances powered — Total: ${totalWatts}W. Each runs in PARALLEL — all get full 240V!`);
    }
  }, [switchStates]);

  const toggle = useCallback((id: string) => {
    setSwitchStates(prev => {
      const next = { ...prev, [id]: !prev[id] };
      addScore(10);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const anyOff = ALL_APPLIANCES.some(a => !switchStates[a.id]);
    const next: Record<string, boolean> = {};
    ALL_APPLIANCES.forEach(a => { next[a.id] = anyOff; });
    addScore(20);
    setSwitchStates(next);
  }, [switchStates]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Right panel */}
      <div
        className="absolute right-3 top-14 z-10 flex flex-col gap-2 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(210px, 23vw, 280px)', maxHeight: 'calc(100% - 4rem)' }}
      >
        {/* Power summary */}
        <div className="game-panel !p-0 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 font-display font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1e40af, #0ea5e9)' }}>
            <span style={{ fontSize: '1.3rem' }}>⚡</span>
            <span style={{ fontSize: '1.05rem' }}>Smart Home Panel</span>
          </div>
          <div className="px-4 py-3">
            <div className="meter-display mb-2">
              <span className="font-mono font-bold text-cyan-400" style={{ fontSize: '1.7rem' }}>
                {totalWatts}<span className="text-cyan-300" style={{ fontSize: '1rem' }}> W</span>
              </span>
            </div>
            <div className="flex justify-between text-slate-500 mb-3" style={{ fontSize: '0.8rem' }}>
              <span>{onCount}/{allCount} appliances ON</span>
              <span>Energy = P × t</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={toggleAll}
              className="w-full py-2 rounded-xl font-display font-bold text-white"
              style={{
                background: onCount === allCount
                  ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                  : 'linear-gradient(135deg,#059669,#10b981)',
                fontSize: '0.95rem',
              }}
            >
              {onCount === allCount ? '⬛ Power Off All' : '⚡ Power On All'}
            </motion.button>
          </div>
        </div>

        {/* Room switches */}
        {ROOMS.map(room => (
          <div key={room.id} className="game-panel !p-0 overflow-hidden">
            <div
              className="px-3 py-2 flex items-center gap-2 font-display font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${room.color}, ${room.color}cc)`, fontSize: '0.92rem' }}
            >
              <span>{room.icon}</span>
              <span>{room.name}</span>
            </div>
            <div className="px-3 py-2 flex flex-col gap-2">
              {room.appliances.map(app => {
                const on = !!switchStates[app.id];
                return (
                  <div key={app.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '1rem' }}>{app.icon}</span>
                      <div>
                        <p className="font-bold text-slate-700" style={{ fontSize: '0.82rem' }}>{app.name}</p>
                        <p style={{ fontSize: '0.72rem', color: on ? '#059669' : '#94a3b8' }}>{app.watts}W</p>
                      </div>
                    </div>
                    <button
                      className={`big-switch ${on ? 'on' : ''}`}
                      onClick={() => toggle(app.id)}
                    >
                      <div className={`big-switch-knob ${on ? 'on' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Completion message */}
        {onCount === allCount && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="game-panel text-center"
            style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}
          >
            <p style={{ fontSize: '1.5rem' }}>🎉</p>
            <p className="font-display font-bold text-green-700" style={{ fontSize: '0.95rem' }}>Spark City is POWERED!</p>
            <p className="text-green-600 mt-1" style={{ fontSize: '0.8rem' }}>Total load: {totalWatts}W in parallel circuits!</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
