import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { ChevronRight, Zap } from 'lucide-react';

const JOURNEY_STEPS = [
  { icon: '💧', label: 'Dam', color: '#3b82f6' },
  { icon: '⚙️', label: 'Generator', color: '#8b5cf6' },
  { icon: '🗼', label: 'Transmission', color: '#f59e0b' },
  { icon: '🏢', label: 'Substation', color: '#06b6d4' },
  { icon: '🏠', label: 'Home Entry', color: '#10b981' },
  { icon: '🔌', label: 'Wiring', color: '#f97316' },
  { icon: '💡', label: 'Appliances', color: '#ec4899' },
  { icon: '🤖', label: 'Smart Home', color: '#14b8a6' },
];

const HOW_TO_PLAY = [
  { icon: '👆', bg: '#eff6ff', text: 'TAP on 3D machines to interact with them' },
  { icon: '🎚️', bg: '#fffbeb', text: 'ADJUST controls to reach the correct setting' },
  { icon: '🔧', bg: '#fef2f2', text: 'DRAG components from the toolbox to install' },
  { icon: '🔌', bg: '#f5f3ff', text: 'CONNECT wires to build safe electrical circuits' },
  { icon: '💡', bg: '#f0fdf4', text: 'SWITCH appliances ON to power the whole city!' },
];

export const StartScreen = () => {
  const { setLevel } = useGameStore();
  const [showHow, setShowHow] = useState(false);
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < HOW_TO_PLAY.length - 1) {
      setStep(s => s + 1);
    } else {
      setLevel(1);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(150deg, #0f172a 0%, #1e3a5f 40%, #0c2340 70%, #0f172a 100%)',
      }}
    >
      {/* Animated background sparks */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: Math.random() * 6 + 3,
            height: Math.random() * 6 + 3,
            background: i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#00c2ff' : '#00e676',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: 0.6,
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}

      {/* Electric grid lines bg */}
      <div className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,194,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Landing */}
      <AnimatePresence>
        {!showHow && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center w-full h-full px-8 gap-6"
          >
            {/* Lightning bolt hero */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
              style={{ fontSize: '5rem', lineHeight: 1 }}
              className="glow-yellow"
            >
              ⚡
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-center"
            >
              <h1
                className="font-display text-white leading-tight text-glow-white"
                style={{ fontSize: 'clamp(2.8rem, 5vw, 4.2rem)' }}
              >
                Spark City<br />
                <span style={{ color: '#ffd700' }} className="text-glow-yellow">Adventure</span>
              </h1>
              <p
                className="mt-3 font-bold"
                style={{ color: '#00c2ff', fontSize: 'clamp(1rem, 1.6vw, 1.25rem)' }}
              >
                From Generation to Home Electricity
              </p>
              <p
                className="mt-1 font-medium"
                style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}
              >
                8 interactive science missions for curious minds!
              </p>
            </motion.div>

            {/* Journey path */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-1 flex-wrap justify-center"
              style={{ maxWidth: '95vw', padding: '0 1rem' }}
            >
              {JOURNEY_STEPS.map((s, i) => (
                <React.Fragment key={s.label}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.45 + i * 0.07, type: 'spring' }}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="rounded-2xl flex items-center justify-center shadow-lg"
                      style={{
                        width: 44, height: 44,
                        background: `${s.color}22`,
                        border: `2.5px solid ${s.color}55`,
                        fontSize: '1.25rem',
                        boxShadow: `0 0 10px ${s.color}44`,
                      }}
                    >
                      {s.icon}
                    </div>
                    <span className="font-bold text-white" style={{ fontSize: '0.62rem', opacity: 0.7 }}>
                      {s.label}
                    </span>
                  </motion.div>
                  {i < JOURNEY_STEPS.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.5 + i * 0.07 }}
                      style={{ color: '#ffd700', fontSize: '1.1rem', marginBottom: 14 }}
                      className="animate-bounce-arrow"
                    >
                      →
                    </motion.div>
                  )}
                </React.Fragment>
              ))}
            </motion.div>

            {/* CTA button */}
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.65, type: 'spring', bounce: 0.4 }}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setShowHow(true); setStep(0); }}
              className="game-btn animate-pulse-yellow"
              style={{
                background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                fontSize: 'clamp(1.1rem, 1.8vw, 1.4rem)',
                paddingLeft: '3rem',
                paddingRight: '3rem',
                paddingTop: '1rem',
                paddingBottom: '1rem',
              }}
            >
              <Zap style={{ width: 22, height: 22 }} />
              Start Adventure!
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}
            >
              🤖 Volt the Robot will guide you every step!
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to Play modal */}
      <AnimatePresence>
        {showHow && (
          <motion.div
            key="howto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(5,15,30,0.8)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              style={{ width: 'min(500px, 92vw)', maxHeight: '90%' }}
            >
              {/* Header */}
              <div
                className="px-8 pt-7 pb-4"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #0ea5e9)' }}
              >
                <h2 className="font-display text-white" style={{ fontSize: '1.8rem' }}>
                  ⚡ How to Play
                </h2>
                <p className="text-blue-200 font-medium mt-1" style={{ fontSize: '0.95rem' }}>
                  Learn the basics before you start!
                </p>
              </div>

              {/* Steps */}
              <div className="px-6 py-5 flex flex-col gap-3 flex-1 overflow-auto">
                {HOW_TO_PLAY.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: i <= step ? 1 : 0.3 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-4 p-4 rounded-2xl transition-all"
                    style={{
                      background: i === step ? item.bg : 'transparent',
                      border: i === step ? `2px solid ${item.bg}` : '2px solid transparent',
                      boxShadow: i === step ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <div
                      className="rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 52, height: 52,
                        background: item.bg,
                        fontSize: '1.6rem',
                        border: i === step ? `2px solid rgba(0,0,0,0.08)` : 'none',
                      }}
                    >
                      {item.icon}
                    </div>
                    <span
                      className="font-bold"
                      style={{
                        fontSize: 'clamp(0.95rem, 1.3vw, 1.1rem)',
                        color: i === step ? '#1e293b' : '#94a3b8',
                      }}
                    >
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex items-center justify-between">
                <div className="flex gap-2">
                  {HOW_TO_PLAY.map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all"
                      style={{
                        height: 8,
                        width: i === step ? 28 : 8,
                        background: i === step ? '#0ea5e9' : '#cbd5e1',
                      }}
                    />
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNext}
                  className="flex items-center gap-2 px-7 py-3 rounded-full text-white font-display font-bold shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 15px rgba(14,165,233,0.4)',
                  }}
                >
                  {step < HOW_TO_PLAY.length - 1 ? (
                    <>Next <ChevronRight style={{ width: 18, height: 18 }} /></>
                  ) : (
                    <>⚡ Let's Go! <ChevronRight style={{ width: 18, height: 18 }} /></>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
