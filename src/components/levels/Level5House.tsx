import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { InfoCard } from '../GameUI';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ComponentId = 'meter' | 'switch' | 'mcb';
type WireType = 'phase' | 'neutral' | 'earth';
type NodeId =
  | 'pole_out'
  | 'meter_in' | 'meter_out'
  | 'switch_in' | 'switch_out'
  | 'mcb_in' | 'mcb_bulb' | 'mcb_fan' | 'mcb_socket'
  | 'bulb_in' | 'fan_in' | 'socket_in';

interface Wire {
  id: string;
  from: NodeId;
  to: NodeId;
  wireType: WireType;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const WIRE_COLORS: Record<WireType, string> = {
  phase: '#ef4444',
  neutral: '#3b82f6',
  earth: '#22c55e',
};

const WIRE_LABELS: Record<WireType, string> = {
  phase: 'Phase (Red)',
  neutral: 'Neutral (Blue)',
  earth: 'Earth (Green)',
};

// Node positions in SVG space (viewBox 0 0 860 480)
const NODE_POS: Record<NodeId, { x: number; y: number }> = {
  pole_out:    { x: 116, y: 198 },
  meter_in:    { x: 162, y: 198 },
  meter_out:   { x: 218, y: 198 },
  switch_in:   { x: 298, y: 198 },
  switch_out:  { x: 358, y: 198 },
  mcb_in:      { x: 438, y: 198 },
  mcb_bulb:    { x: 524, y: 168 },
  mcb_fan:     { x: 524, y: 200 },
  mcb_socket:  { x: 524, y: 232 },
  bulb_in:     { x: 630, y: 168 },
  fan_in:      { x: 700, y: 200 },
  socket_in:   { x: 680, y: 310 },
};

// Which connections are valid and in what order they can be made
const VALID_CONNECTIONS: [NodeId, NodeId][] = [
  ['pole_out', 'meter_in'],
  ['meter_out', 'switch_in'],
  ['switch_out', 'mcb_in'],
  ['mcb_bulb', 'bulb_in'],
  ['mcb_fan', 'fan_in'],
  ['mcb_socket', 'socket_in'],
];

function isValidConnection(from: NodeId, to: NodeId): boolean {
  return VALID_CONNECTIONS.some(
    ([a, b]) => (a === from && b === to) || (a === to && b === from)
  );
}

const COMPONENT_INFO: Record<ComponentId, { label: string; icon: string; tip: string }> = {
  meter: {
    label: 'Electric Meter',
    icon: '📊',
    tip: 'Counts every kWh you use. 1 kWh = 1000W for 1 hour — this is how your electricity bill is calculated!',
  },
  switch: {
    label: 'Main Switch',
    icon: '🔴',
    tip: 'Isolates ALL power instantly. Always turn this OFF before doing any electrical work — safety first!',
  },
  mcb: {
    label: 'MCB Panel',
    icon: '🛡️',
    tip: 'Miniature Circuit Breakers protect each room. They trip in 0.01 seconds — faster than a heartbeat!',
  },
};

const TOOLKIT_ITEMS = [
  { id: 'meter' as ComponentId, label: 'Electric Meter', icon: '📊', color: '#8b5cf6' },
  { id: 'switch' as ComponentId, label: 'Main Switch', icon: '🔴', color: '#ef4444' },
  { id: 'mcb' as ComponentId, label: 'MCB Panel', icon: '🛡️', color: '#059669' },
];

// ─────────────────────────────────────────────
// Wire Type Selector
// ─────────────────────────────────────────────

const WireSelector = ({
  selected,
  onSelect,
}: {
  selected: WireType | null;
  onSelect: (w: WireType | null) => void;
}) => (
  <div className="game-panel">
    <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.88rem' }}>
      🔌 Select Wire Type
    </h3>
    <div className="flex flex-col gap-1.5">
      {(['phase', 'neutral', 'earth'] as WireType[]).map(w => (
        <button
          key={w}
          onClick={() => onSelect(selected === w ? null : w)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-left"
          style={{
            background: selected === w ? `${WIRE_COLORS[w]}22` : '#f8fafc',
            border: `2px solid ${selected === w ? WIRE_COLORS[w] : '#e2e8f0'}`,
            color: WIRE_COLORS[w],
            fontSize: '0.82rem',
            boxShadow: selected === w ? `0 0 10px ${WIRE_COLORS[w]}44` : 'none',
          }}
        >
          <div
            className="rounded-full flex-shrink-0"
            style={{ width: 12, height: 12, background: WIRE_COLORS[w] }}
          />
          {WIRE_LABELS[w]}
        </button>
      ))}
    </div>
    {selected && (
      <p className="text-xs text-slate-400 mt-2 text-center">
        Click a source node, then a destination node
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────
// SVG House Diagram
// ─────────────────────────────────────────────

interface DiagramProps {
  placed: Set<ComponentId>;
  wires: Wire[];
  pendingFrom: NodeId | null;
  selectedWire: WireType | null;
  hoverNode: NodeId | null;
  onNodeClick: (id: NodeId) => void;
  onNodeHover: (id: NodeId | null) => void;
  onZoneClick: (id: ComponentId) => void;
  powered: boolean;
}

const HouseDiagram = ({
  placed, wires, pendingFrom, selectedWire, hoverNode,
  onNodeClick, onNodeHover, onZoneClick, powered,
}: DiagramProps) => {
  const hasWire = (from: NodeId, to: NodeId, type?: WireType) =>
    wires.some(w =>
      ((w.from === from && w.to === to) || (w.from === to && w.to === from)) &&
      (type ? w.wireType === type : true)
    );

  const isNodeActive = (id: NodeId) => id === pendingFrom || id === hoverNode;

  const renderNode = (id: NodeId, label?: string) => {
    const pos = NODE_POS[id];
    const active = isNodeActive(id);
    return (
      <g
        key={id}
        style={{ cursor: selectedWire ? 'pointer' : 'default' }}
        onClick={() => selectedWire && onNodeClick(id)}
        onMouseEnter={() => onNodeHover(id)}
        onMouseLeave={() => onNodeHover(null)}
      >
        <circle
          cx={pos.x} cy={pos.y} r={7}
          fill={active ? '#fbbf24' : '#fff'}
          stroke={active ? '#f59e0b' : '#64748b'}
          strokeWidth={active ? 3 : 2}
          style={{ filter: active ? 'drop-shadow(0 0 4px #fbbf24)' : 'none' }}
        />
        {label && (
          <text x={pos.x} y={pos.y + 18} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="600">{label}</text>
        )}
      </g>
    );
  };

  const renderWires = () =>
    wires.map(w => {
      const from = NODE_POS[w.from];
      const to = NODE_POS[w.to];
      const offset = w.wireType === 'phase' ? -5 : w.wireType === 'neutral' ? 0 : 5;
      return (
        <g key={w.id}>
          <line
            x1={from.x} y1={from.y + offset}
            x2={to.x} y2={to.y + offset}
            stroke={WIRE_COLORS[w.wireType]}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
          {powered && (
            <line
              x1={from.x} y1={from.y + offset}
              x2={to.x} y2={to.y + offset}
              stroke="#fff"
              strokeWidth={1}
              strokeDasharray="6 12"
              opacity={0.7}
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.4s" repeatCount="indefinite" />
            </line>
          )}
        </g>
      );
    });

  const bulbWires = (['phase', 'neutral', 'earth'] as WireType[]).filter(t =>
    hasWire('mcb_bulb', 'bulb_in', t)
  );
  const fanWires = (['phase', 'neutral', 'earth'] as WireType[]).filter(t =>
    hasWire('mcb_fan', 'fan_in', t)
  );
  const socketWires = (['phase', 'neutral', 'earth'] as WireType[]).filter(t =>
    hasWire('mcb_socket', 'socket_in', t)
  );
  const bulbOn = bulbWires.length === 3 && powered;
  const fanOn = fanWires.length === 3 && powered;
  const socketOn = socketWires.length === 3 && powered;

  return (
    <svg viewBox="0 0 860 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* Sky background */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="socketGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="860" height="480" fill="url(#sky)" />
      <rect x="0" y="380" width="860" height="100" fill="url(#grass)" />

      {/* ── Utility Pole ── */}
      <rect x="58" y="100" width="14" height="300" rx="3" fill="#92400e" />
      <rect x="44" y="100" width="42" height="8" rx="2" fill="#a16207" />
      {/* Insulators */}
      <ellipse cx="52" cy="104" rx="5" ry="3" fill="#94a3b8" />
      <ellipse cx="78" cy="104" rx="5" ry="3" fill="#94a3b8" />
      <text x="65" y="90" textAnchor="middle" fontSize={10} fill="#475569" fontWeight="700">
        UTILITY POLE
      </text>
      {/* Service cable from pole */}
      <path d="M78 104 Q130 140 162 198" stroke="#374151" strokeWidth={3} fill="none" strokeDasharray="6 3" />

      {/* ── House Outline ── */}
      <rect x="130" y="80" width="700" height="320" rx="8" fill="white" stroke="#cbd5e1" strokeWidth="2" />
      {/* Roof */}
      <polygon points="130,80 480,30 830,80" fill="#475569" />

      {/* Interior walls (room divisions) */}
      <line x1="380" y1="80" x2="380" y2="400" stroke="#e2e8f0" strokeWidth="8" />
      <line x1="570" y1="80" x2="570" y2="400" stroke="#e2e8f0" strokeWidth="8" />

      {/* Room labels */}
      <text x="255" y="110" textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight="600">ENTRY / PANEL</text>
      <text x="475" y="110" textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight="600">LIVING ROOM</text>
      <text x="700" y="110" textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight="600">BEDROOM / KITCHEN</text>

      {/* ── Snap Zones ── */}

      {/* Meter zone */}
      <rect
        x="152" y="165" width="76" height="70" rx="6"
        fill={placed.has('meter') ? '#ede9fe' : '#f1f5f9'}
        stroke={placed.has('meter') ? '#8b5cf6' : '#cbd5e1'}
        strokeWidth="2" strokeDasharray={placed.has('meter') ? '0' : '5 3'}
        style={{ cursor: placed.has('meter') ? 'default' : 'pointer' }}
        onClick={() => !placed.has('meter') && onZoneClick('meter')}
      />
      {placed.has('meter') ? (
        <g>
          <rect x="156" y="170" width="66" height="56" rx="4" fill="white" stroke="#8b5cf6" strokeWidth="1.5" />
          <text x="189" y="189" textAnchor="middle" fontSize={14}>📊</text>
          <text x="189" y="206" textAnchor="middle" fontSize={8} fill="#7c3aed" fontWeight="700">ELECTRIC</text>
          <text x="189" y="216" textAnchor="middle" fontSize={8} fill="#7c3aed" fontWeight="700">METER</text>
          <rect x="166" y="222" width="46" height="4" rx="2" fill="#ddd6fe" />
        </g>
      ) : (
        <text x="190" y="205" textAnchor="middle" fontSize={9} fill="#94a3b8">+ Meter</text>
      )}

      {/* Switch zone */}
      <rect
        x="278" y="165" width="90" height="70" rx="6"
        fill={placed.has('switch') ? '#fee2e2' : '#f1f5f9'}
        stroke={placed.has('switch') ? '#ef4444' : '#cbd5e1'}
        strokeWidth="2" strokeDasharray={placed.has('switch') ? '0' : '5 3'}
        style={{ cursor: placed.has('switch') ? 'default' : 'pointer' }}
        onClick={() => !placed.has('switch') && onZoneClick('switch')}
      />
      {placed.has('switch') ? (
        <g>
          <rect x="282" y="170" width="80" height="56" rx="4" fill="white" stroke="#ef4444" strokeWidth="1.5" />
          <text x="322" y="189" textAnchor="middle" fontSize={14}>🔴</text>
          <text x="322" y="206" textAnchor="middle" fontSize={8} fill="#dc2626" fontWeight="700">MAIN</text>
          <text x="322" y="216" textAnchor="middle" fontSize={8} fill="#dc2626" fontWeight="700">SWITCH</text>
          {/* Lever */}
          <rect x="316" y="220" width="12" height="10" rx="2" fill="#fbbf24" />
        </g>
      ) : (
        <text x="323" y="205" textAnchor="middle" fontSize={9} fill="#94a3b8">+ Switch</text>
      )}

      {/* MCB zone */}
      <rect
        x="420" y="145" width="110" height="110" rx="6"
        fill={placed.has('mcb') ? '#dcfce7' : '#f1f5f9'}
        stroke={placed.has('mcb') ? '#22c55e' : '#cbd5e1'}
        strokeWidth="2" strokeDasharray={placed.has('mcb') ? '0' : '5 3'}
        style={{ cursor: placed.has('mcb') ? 'default' : 'pointer' }}
        onClick={() => !placed.has('mcb') && onZoneClick('mcb')}
      />
      {placed.has('mcb') ? (
        <g>
          <rect x="425" y="150" width="98" height="98" rx="4" fill="white" stroke="#16a34a" strokeWidth="1.5" />
          <text x="474" y="176" textAnchor="middle" fontSize={14}>🛡️</text>
          <text x="474" y="194" textAnchor="middle" fontSize={8} fill="#15803d" fontWeight="700">MCB PANEL</text>
          {/* Breakers */}
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={434 + i * 22} y={200} width={16} height={36} rx={2}
              fill={i < 2 ? '#22c55e' : '#f59e0b'} />
          ))}
        </g>
      ) : (
        <text x="475" y="205" textAnchor="middle" fontSize={9} fill="#94a3b8">+ MCB Panel</text>
      )}

      {/* ── Wires ── */}
      {renderWires()}

      {/* ── Appliances ── */}

      {/* Bulb */}
      <g>
        {bulbOn && <ellipse cx="630" cy="155" rx="28" ry="28" fill="url(#bulbGlow)" opacity="0.8" />}
        <ellipse cx="630" cy="162" rx="16" ry="20" fill={bulbOn ? '#fef08a' : '#e2e8f0'} stroke="#94a3b8" strokeWidth="1.5" />
        <rect x="624" y="182" width="12" height="8" rx="2" fill="#9ca3af" />
        <line x1="630" y1="140" x2="630" y2="142" stroke="#94a3b8" strokeWidth="2" />
        {bulbOn && (
          <>
            <line x1="630" y1="128" x2="630" y2="134" stroke="#fbbf24" strokeWidth="2" />
            <line x1="618" y1="132" x2="622" y2="136" stroke="#fbbf24" strokeWidth="2" />
            <line x1="642" y1="132" x2="638" y2="136" stroke="#fbbf24" strokeWidth="2" />
          </>
        )}
        <text x="630" y="215" textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="600">BULB</text>
        {/* Wire indicators */}
        <g>
          {bulbWires.map((t, i) => (
            <circle key={t} cx={614 + i * 9} cy={230} r={4} fill={WIRE_COLORS[t]} />
          ))}
        </g>
      </g>

      {/* Fan */}
      <g style={{ transformOrigin: '700px 172px' }}>
        <circle cx="700" cy="172" r="22" fill={fanOn ? '#dbeafe' : '#f1f5f9'} stroke="#94a3b8" strokeWidth="1.5" />
        {[0, 90, 180, 270].map((angle, i) => (
          <ellipse
            key={i}
            cx={700 + Math.cos((angle * Math.PI) / 180) * 10}
            cy={172 + Math.sin((angle * Math.PI) / 180) * 10}
            rx={8} ry={4}
            fill={fanOn ? '#93c5fd' : '#cbd5e1'}
            transform={`rotate(${angle}, 700, 172)`}
          >
            {fanOn && <animateTransform attributeName="transform" type="rotate" from={`${angle} 700 172`} to={`${angle + 360} 700 172`} dur="0.6s" repeatCount="indefinite" />}
          </ellipse>
        ))}
        <circle cx="700" cy="172" r="4" fill="#64748b" />
        <text x="700" y="215" textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="600">FAN</text>
        <g>
          {fanWires.map((t, i) => (
            <circle key={t} cx={684 + i * 9} cy={230} r={4} fill={WIRE_COLORS[t]} />
          ))}
        </g>
      </g>

      {/* Socket */}
      <g>
        {socketOn && <ellipse cx="680" cy="310" rx="22" ry="22" fill="url(#socketGlow)" opacity="0.7" />}
        <rect x="660" y="290" width="40" height="40" rx="5" fill={socketOn ? '#fff7ed' : '#f1f5f9'} stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="673" cy="305" r="4" fill={socketOn ? '#fb923c' : '#9ca3af'} />
        <circle cx="687" cy="305" r="4" fill={socketOn ? '#fb923c' : '#9ca3af'} />
        <rect x="677" y="314" width="6" height="8" rx="1" fill={socketOn ? '#fb923c' : '#9ca3af'} />
        <text x="680" y="350" textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="600">SOCKET</text>
        <g>
          {socketWires.map((t, i) => (
            <circle key={t} cx={664 + i * 9} cy={360} r={4} fill={WIRE_COLORS[t]} />
          ))}
        </g>
      </g>

      {/* ── Connection Nodes ── */}
      {placed.has('meter') && renderNode('meter_in', 'IN')}
      {placed.has('meter') && renderNode('meter_out', 'OUT')}
      {placed.has('switch') && renderNode('switch_in', 'IN')}
      {placed.has('switch') && renderNode('switch_out', 'OUT')}
      {placed.has('mcb') && renderNode('mcb_in', 'IN')}
      {placed.has('mcb') && renderNode('mcb_bulb', '→💡')}
      {placed.has('mcb') && renderNode('mcb_fan', '→🌀')}
      {placed.has('mcb') && renderNode('mcb_socket', '→🔌')}
      {renderNode('pole_out', 'OUT')}
      {renderNode('bulb_in', 'IN')}
      {renderNode('fan_in', 'IN')}
      {renderNode('socket_in', 'IN')}

      {/* ── Spark on invalid connection ── */}

      {/* ── Legend ── */}
      <g>
        <rect x="136" y="410" width="160" height="60" rx="6" fill="white" fillOpacity="0.9" stroke="#e2e8f0" strokeWidth="1" />
        <text x="216" y="427" textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="700">WIRE LEGEND</text>
        {(['phase', 'neutral', 'earth'] as WireType[]).map((t, i) => (
          <g key={t}>
            <line x1="148" y1={440 + i * 12} x2="162" y2={440 + i * 12} stroke={WIRE_COLORS[t]} strokeWidth={3} strokeLinecap="round" />
            <text x="168" y={444 + i * 12} fontSize={9} fill="#475569">{WIRE_LABELS[t]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ─────────────────────────────────────────────
// Main Level Component
// ─────────────────────────────────────────────

export const Level5House = () => {
  const { setVoltMessage, setLevelComplete, addScore, addStar } = useGameStore();

  const [placed, setPlaced] = useState<Set<ComponentId>>(new Set());
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedTool, setSelectedTool] = useState<ComponentId | null>(null);
  const [selectedWire, setSelectedWire] = useState<WireType | null>(null);
  const [pendingFrom, setPendingFrom] = useState<NodeId | null>(null);
  const [hoverNode, setHoverNode] = useState<NodeId | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'ok' | 'warn' | 'error'>('ok');
  const [sparkNode, setSparkNode] = useState<NodeId | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [activeInfo, setActiveInfo] = useState<ComponentId | null>(null);

  const allPlaced = placed.size === 3;

  const mainChainDone =
    wires.some(w => (w.from === 'pole_out' && w.to === 'meter_in') || (w.from === 'meter_in' && w.to === 'pole_out')) &&
    wires.some(w => (w.from === 'meter_out' && w.to === 'switch_in') || (w.from === 'switch_in' && w.to === 'meter_out')) &&
    wires.some(w => (w.from === 'switch_out' && w.to === 'mcb_in') || (w.from === 'mcb_in' && w.to === 'switch_out'));

  const applianceWires = (node: NodeId, target: NodeId) =>
    (['phase', 'neutral', 'earth'] as WireType[]).every(t =>
      wires.some(w =>
        ((w.from === node && w.to === target) || (w.from === target && w.to === node)) &&
        w.wireType === t
      )
    );

  const bulbComplete = applianceWires('mcb_bulb', 'bulb_in');
  const fanComplete = applianceWires('mcb_fan', 'fan_in');
  const socketComplete = applianceWires('mcb_socket', 'socket_in');

  const powered = mainChainDone && (bulbComplete || fanComplete || socketComplete);
  const levelComplete = mainChainDone && bulbComplete && fanComplete && socketComplete;

  const showFeedback = (msg: string, type: 'ok' | 'warn' | 'error' = 'ok') => {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(''), 3500);
  };

  useEffect(() => {
    setVoltMessage('🏠 Level 5: Build the home wiring system! Place components and connect the wires.');
  }, []);

  useEffect(() => {
    if (levelComplete && !showCompletion) {
      setTimeout(() => {
        setShowCompletion(true);
        addScore(100);
        addStar();
        setLevelComplete(true);
      }, 800);
    }
  }, [levelComplete]);

  const handleToolSelect = (id: ComponentId) => {
    if (placed.has(id)) {
      setActiveInfo(id);
      showFeedback(`${COMPONENT_INFO[id].icon} ${COMPONENT_INFO[id].tip}`, 'ok');
      return;
    }
    setSelectedTool(selectedTool === id ? null : id);
    setSelectedWire(null);
    showFeedback(`Selected: ${COMPONENT_INFO[id].label}. Click its zone in the house to place it.`, 'ok');
  };

  const handleZoneClick = (id: ComponentId) => {
    if (placed.has(id)) return;
    if (selectedTool === id) {
      setPlaced(prev => new Set(prev).add(id));
      setSelectedTool(null);
      showFeedback(`✅ ${COMPONENT_INFO[id].label} placed! ${COMPONENT_INFO[id].tip}`, 'ok');
      setVoltMessage(`✅ ${COMPONENT_INFO[id].label} installed! ${allPlaced ? 'Now connect the wires!' : 'Keep placing components.'}`);
    } else {
      showFeedback(`👆 First select "${COMPONENT_INFO[id].label}" from the toolkit on the left!`, 'warn');
    }
  };

  const handleNodeClick = useCallback((id: NodeId) => {
    if (!selectedWire) return;
    if (!pendingFrom) {
      setPendingFrom(id);
      showFeedback(`🔌 Starting from node "${id}". Now click the destination node.`, 'ok');
    } else {
      if (pendingFrom === id) {
        setPendingFrom(null);
        return;
      }
      const valid = isValidConnection(pendingFrom, id);
      const alreadyExists = wires.some(
        w => ((w.from === pendingFrom && w.to === id) || (w.from === id && w.to === pendingFrom)) && w.wireType === selectedWire
      );
      if (alreadyExists) {
        showFeedback('⚠️ This wire already exists between those nodes.', 'warn');
      } else if (valid) {
        const newWire: Wire = {
          id: `${pendingFrom}-${id}-${selectedWire}-${Date.now()}`,
          from: pendingFrom,
          to: id,
          wireType: selectedWire,
        };
        setWires(prev => [...prev, newWire]);

        // Check earth wire reminder
        if (selectedWire === 'phase' && (id === 'bulb_in' || id === 'fan_in' || id === 'socket_in')) {
          showFeedback('✅ Phase wire connected! Remember: you also need Neutral and Earth wires for safety!', 'ok');
        } else if (selectedWire === 'neutral' && !wires.some(w => w.wireType === 'earth' && (w.to === id || w.from === id))) {
          showFeedback('✅ Neutral wire connected! Don\'t forget the Earth wire — it prevents electric shocks!', 'ok');
        } else {
          showFeedback('✅ Wire connected successfully!', 'ok');
        }
      } else {
        setSparkNode(id);
        setTimeout(() => setSparkNode(null), 600);
        showFeedback('❌ Invalid connection! Follow the sequence: Pole → Meter → Switch → MCB → Appliances', 'error');
      }
      setPendingFrom(null);
    }
  }, [selectedWire, pendingFrom, wires]);

  const handleWireSelect = (w: WireType | null) => {
    setSelectedWire(w);
    setPendingFrom(null);
    setSelectedTool(null);
    if (w) {
      const tips: Record<WireType, string> = {
        phase: '🔴 Phase wire selected (240V Live). Connect: Pole→Meter→Switch→MCB→Appliances',
        neutral: '🔵 Neutral wire selected (Return path). Connect each appliance back to MCB',
        earth: '🟢 Earth wire selected (Safety). Essential! Prevents electrocution!',
      };
      showFeedback(tips[w], 'ok');
    }
  };

  const resetWires = () => {
    setWires([]);
    setPendingFrom(null);
    showFeedback('🔄 All wires cleared. Start fresh!', 'warn');
  };

  const progressSteps = [
    { label: 'Meter placed', done: placed.has('meter') },
    { label: 'Switch placed', done: placed.has('switch') },
    { label: 'MCB placed', done: placed.has('mcb') },
    { label: 'Main chain wired', done: mainChainDone },
    { label: 'Appliances connected', done: bulbComplete || fanComplete || socketComplete },
    { label: 'All appliances done', done: bulbComplete && fanComplete && socketComplete },
  ];

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#f0f9ff' }}>

      {/* ── Left Toolkit ── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 flex flex-col gap-3 p-3 pointer-events-auto overflow-y-auto"
        style={{ width: 170, background: 'rgba(255,255,255,0.95)', borderRight: '2px solid #e2e8f0', boxShadow: '2px 0 16px rgba(0,0,0,0.08)' }}
      >
        <div className="text-center pt-10">
          <div className="font-bold text-slate-700" style={{ fontSize: '0.8rem' }}>🔧 TOOLKIT</div>
          <div className="text-slate-400 mt-0.5" style={{ fontSize: '0.68rem' }}>Click to select, then click zone</div>
        </div>

        <div className="h-px bg-slate-200" />

        <div className="font-bold text-slate-500 text-center" style={{ fontSize: '0.72rem' }}>COMPONENTS</div>

        {TOOLKIT_ITEMS.map(item => (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleToolSelect(item.id)}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl font-bold transition-all"
            style={{
              background: placed.has(item.id)
                ? '#f0fdf4'
                : selectedTool === item.id
                ? `${item.color}18`
                : '#f8fafc',
              border: `2px solid ${placed.has(item.id) ? '#22c55e' : selectedTool === item.id ? item.color : '#e2e8f0'}`,
              color: placed.has(item.id) ? '#15803d' : item.color,
              fontSize: '0.78rem',
              position: 'relative',
              opacity: placed.has(item.id) ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
            <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{item.label}</span>
            {placed.has(item.id) && (
              <span
                className="absolute top-1 right-1 rounded-full font-bold text-white"
                style={{ background: '#22c55e', fontSize: '0.6rem', padding: '1px 5px' }}
              >
                ✓ Placed
              </span>
            )}
            {selectedTool === item.id && (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute top-1 right-1 rounded-full font-bold text-white"
                style={{ background: item.color, fontSize: '0.6rem', padding: '1px 5px' }}
              >
                Selected
              </motion.span>
            )}
          </motion.button>
        ))}

        <div className="h-px bg-slate-200" />

        {/* Wire types */}
        {allPlaced && (
          <>
            <div className="font-bold text-slate-500 text-center" style={{ fontSize: '0.72rem' }}>WIRE TYPES</div>
            {(['phase', 'neutral', 'earth'] as WireType[]).map(w => (
              <button
                key={w}
                onClick={() => handleWireSelect(selectedWire === w ? null : w)}
                className="flex items-center gap-2 px-2 py-2 rounded-xl font-bold transition-all"
                style={{
                  background: selectedWire === w ? `${WIRE_COLORS[w]}20` : '#f8fafc',
                  border: `2px solid ${selectedWire === w ? WIRE_COLORS[w] : '#e2e8f0'}`,
                  color: WIRE_COLORS[w],
                  fontSize: '0.75rem',
                }}
              >
                <div className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: WIRE_COLORS[w] }} />
                {WIRE_LABELS[w]}
              </button>
            ))}
            {wires.length > 0 && (
              <button
                onClick={resetWires}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                🔄 Clear wires
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Main SVG Diagram ── */}
      <div
        className="absolute inset-0 z-0"
        style={{ left: 170, right: 'clamp(220px, 25vw, 300px)' }}
      >
        <HouseDiagram
          placed={placed}
          wires={wires}
          pendingFrom={pendingFrom}
          selectedWire={selectedWire}
          hoverNode={hoverNode}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoverNode}
          onZoneClick={handleZoneClick}
          powered={powered}
        />
      </div>

      {/* ── Feedback Toast ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute pointer-events-none z-30"
            style={{ top: 60, left: '50%', transform: 'translateX(-50%)', width: 'min(420px, 55vw)' }}
          >
            <div
              className="px-5 py-3 rounded-2xl font-medium text-center shadow-lg"
              style={{
                background:
                  feedbackType === 'error' ? '#fee2e2'
                  : feedbackType === 'warn' ? '#fff7ed'
                  : '#f0fdf4',
                border: `2px solid ${feedbackType === 'error' ? '#ef4444' : feedbackType === 'warn' ? '#f59e0b' : '#22c55e'}`,
                color: feedbackType === 'error' ? '#991b1b' : feedbackType === 'warn' ? '#92400e' : '#166534',
                fontSize: '0.85rem',
              }}
            >
              {feedback}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right Info Panel ── */}
      <div
        className="absolute right-3 top-14 bottom-3 z-10 flex flex-col gap-3 pointer-events-auto overflow-y-auto"
        style={{ width: 'clamp(215px, 24vw, 295px)', paddingBottom: '0.25rem' }}
      >
        <InfoCard title="Home Wiring" icon="🏠" colorClass="from-emerald-700 to-emerald-500">
          <p><strong>Path:</strong> Pole → Meter → Switch → MCB → Appliances</p>
          <p><strong>3 Wires:</strong> Phase (🔴 live), Neutral (🔵 return), Earth (🟢 safety)</p>
          <p><strong>Earth</strong> is critical — it diverts fault current and prevents electrocution!</p>
        </InfoCard>

        {/* Progress */}
        <div className="game-panel">
          <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.88rem' }}>
            📋 Mission Progress
          </h3>
          {progressSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <div
                className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
                style={{
                  width: 20, height: 20, fontSize: '0.65rem',
                  background: s.done ? '#22c55e' : '#e2e8f0',
                  color: s.done ? 'white' : '#94a3b8',
                }}
              >
                {s.done ? '✓' : i + 1}
              </div>
              <span
                className="font-medium"
                style={{ fontSize: '0.78rem', color: s.done ? '#166534' : '#94a3b8' }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Wire status per appliance */}
        {placed.has('mcb') && (
          <div className="game-panel">
            <h3 className="font-bold text-slate-700 mb-2" style={{ fontSize: '0.88rem' }}>
              🔌 Appliance Wiring
            </h3>
            {[
              { label: '💡 Bulb', done: bulbComplete, from: 'mcb_bulb' as NodeId, to: 'bulb_in' as NodeId },
              { label: '🌀 Fan', done: fanComplete, from: 'mcb_fan' as NodeId, to: 'fan_in' as NodeId },
              { label: '🔌 Socket', done: socketComplete, from: 'mcb_socket' as NodeId, to: 'socket_in' as NodeId },
            ].map(appliance => {
              const connected = (['phase', 'neutral', 'earth'] as WireType[]).filter(t =>
                wires.some(w =>
                  ((w.from === appliance.from && w.to === appliance.to) || (w.from === appliance.to && w.to === appliance.from)) &&
                  w.wireType === t
                )
              );
              return (
                <div key={appliance.label} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-600" style={{ fontSize: '0.8rem' }}>{appliance.label}</span>
                    {appliance.done
                      ? <span className="text-green-600 font-bold text-xs">✅ Ready</span>
                      : <span className="text-slate-400 text-xs">{connected.length}/3 wires</span>
                    }
                  </div>
                  <div className="flex gap-1">
                    {(['phase', 'neutral', 'earth'] as WireType[]).map(t => (
                      <div
                        key={t}
                        className="rounded flex-1 h-2"
                        style={{
                          background: connected.includes(t) ? WIRE_COLORS[t] : '#e2e8f0',
                          opacity: connected.includes(t) ? 1 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                  {!connected.includes('earth') && connected.length > 0 && !appliance.done && (
                    <p className="text-amber-600 font-bold mt-0.5" style={{ fontSize: '0.7rem' }}>
                      ⚠️ No earth wire! Risk of shock!
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Status badge */}
        {powered && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="game-panel text-center"
            style={{ border: '2px solid #22c55e', background: '#f0fdf4' }}
          >
            <div style={{ fontSize: '2rem' }}>⚡💡</div>
            <p className="font-bold text-green-700 mt-1" style={{ fontSize: '0.9rem' }}>
              House is powered!
            </p>
            <p className="text-green-600" style={{ fontSize: '0.75rem' }}>
              {levelComplete ? 'All appliances working!' : 'Connect remaining appliances!'}
            </p>
          </motion.div>
        )}
      </div>

      {/* ── Completion Modal ── */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-4 px-8 py-7 rounded-3xl"
              style={{
                background: 'white',
                boxShadow: '0 12px 50px rgba(0,0,0,0.2)',
                border: '3px solid #22c55e',
                maxWidth: 440,
                width: '90%',
              }}
            >
              <div style={{ fontSize: '3.5rem' }}>🏠⭐✅</div>
              <h2 className="font-bold text-slate-800 text-center" style={{ fontSize: '1.35rem' }}>
                House Fully Wired!
              </h2>
              <div className="w-full space-y-2">
                {[
                  { icon: '📊', label: 'Electric Meter', desc: 'Tracks your kWh usage', color: '#8b5cf6' },
                  { icon: '🔴', label: 'Main Switch', desc: 'Isolates all power instantly', color: '#ef4444' },
                  { icon: '🛡️', label: 'MCB Panel', desc: 'Protects each circuit', color: '#22c55e' },
                  { icon: '🔴🔵🟢', label: '3-Wire System', desc: 'Phase, Neutral & Earth', color: '#f59e0b' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: `${item.color}12`, border: `1.5px solid ${item.color}33` }}>
                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                    <div>
                      <p className="font-bold" style={{ color: item.color, fontSize: '0.85rem' }}>{item.label}</p>
                      <p className="text-slate-500" style={{ fontSize: '0.75rem' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl px-4 py-2.5 w-full" style={{ background: '#fef9c3', border: '2px solid #fde047' }}>
                <p className="font-bold text-amber-700 text-center" style={{ fontSize: '0.82rem' }}>
                  💡 Safety Rule: Always connect Earth wire before turning on power!
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCompletion(false)}
                className="px-8 py-3 rounded-2xl font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                  fontSize: '1.05rem',
                  boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
                }}
              >
                Continue →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
