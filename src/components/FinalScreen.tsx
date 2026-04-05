import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { RotateCcw, Star } from 'lucide-react';

const CONFETTI_COLORS = ['#ffd700', '#a78bfa', '#34d399', '#f87171', '#60a5fa', '#fb923c'];

const ConfettiPiece = ({ i }: { i: number }) => {
  const left = (i * 3.33) % 100;
  const delay = (i * 0.1) % 2;
  const duration = 3 + (i % 4);
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const size = 8 + (i % 8);
  return (
    <motion.div
      className="absolute pointer-events-none rounded-sm"
      style={{ left: `${left}%`, top: -20, width: size, height: size * 0.6, background: color, opacity: 0.9 }}
      animate={{
        y: ['0vh', '110vh'],
        rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
        x: [0, (i % 3 - 1) * 80],
        opacity: [1, 1, 0],
      }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    />
  );
};

export const FinalScreen = () => {
  const { score, stars, resetGame } = useGameStore();
  const maxStars = 8;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden select-none py-6"
      style={{ background: 'linear-gradient(150deg, #1e1b4b 0%, #3730a3 35%, #1e40af 65%, #0c2340 100%)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(165,180,252,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(165,180,252,0.5) 1px,transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {[...Array(24)].map((_, i) => <ConfettiPiece key={i} i={i} />)}

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
        className="z-10 text-center mb-3"
        style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', lineHeight: 1 }}
      >
        🏆
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="z-10 text-center mb-4 px-4"
      >
        <h1
          className="font-display text-white leading-tight"
          style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', textShadow: '0 0 30px rgba(255,215,0,0.6)' }}
        >
          ⚡ CITY POWERED! ⚡
        </h1>
        <p
          className="mt-2 font-medium"
          style={{
            color: '#a5b4fc',
            fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)',
            maxWidth: 560,
            lineHeight: 1.6,
          }}
        >
          You guided electricity from the Hydroelectric Dam through transmission lines, the substation, into the home — and powered every appliance!
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="z-10 px-8 py-5 flex flex-col items-center gap-4 mb-5"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          borderRadius: '1.5rem',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: 'min(300px, 90vw)',
        }}
      >
        <h3 className="font-display text-white" style={{ fontSize: '1.3rem' }}>Final Score</h3>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring', bounce: 0.4 }}
          className="font-display"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.7)' }}
        >
          {score.toLocaleString()}
        </motion.div>

        <div className="flex gap-2 flex-wrap justify-center">
          {[...Array(maxStars)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.8 + i * 0.08, type: 'spring', bounce: 0.5 }}
            >
              <Star
                style={{
                  width: 'clamp(22px, 3vw, 32px)',
                  height: 'clamp(22px, 3vw, 32px)',
                  fill: i < stars ? '#ffd700' : 'transparent',
                  color: i < stars ? '#ffd700' : '#475569',
                  filter: i < stars ? 'drop-shadow(0 0 6px rgba(255,215,0,0.8))' : 'none',
                }}
              />
            </motion.div>
          ))}
        </div>

        <p className="font-bold" style={{ color: '#a5b4fc', fontSize: '0.9rem' }}>
          {stars >= 7 ? '⭐ Electric Genius!' : stars >= 5 ? '🌟 Power Engineer!' : '🔌 Spark Explorer!'}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="z-10 flex gap-2 flex-wrap justify-center mb-5 px-4"
        style={{ maxWidth: 580 }}
      >
        {[
          { icon: '💧', label: 'Dam' },
          { icon: '⚙️', label: 'Generator' },
          { icon: '🗼', label: 'Lines' },
          { icon: '🏢', label: 'Substation' },
          { icon: '🏠', label: 'Home Entry' },
          { icon: '🔌', label: 'Wiring' },
          { icon: '💡', label: 'Appliances' },
          { icon: '🤖', label: 'Smart Home' },
        ].map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1 + i * 0.07, type: 'spring' }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{
                  width: 'clamp(36px, 4vw, 44px)',
                  height: 'clamp(36px, 4vw, 44px)',
                  background: 'rgba(99,102,241,0.3)',
                  border: '2px solid rgba(165,180,252,0.6)',
                  fontSize: 'clamp(1rem, 1.4vw, 1.25rem)',
                }}
              >
                {step.icon}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(0.5rem, 0.7vw, 0.6rem)', fontWeight: 'bold' }}>
                {step.label}
              </span>
            </motion.div>
            {i < arr.length - 1 && (
              <span style={{ color: '#a5b4fc', fontSize: '0.9rem', paddingBottom: 14 }} className="animate-bounce-arrow">
                →
              </span>
            )}
          </React.Fragment>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', bounce: 0.4 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.95 }}
        onClick={resetGame}
        className="z-10 flex items-center gap-3 px-8 py-3 rounded-2xl font-display font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
          border: '2px solid rgba(255,255,255,0.2)',
        }}
      >
        <RotateCcw style={{ width: 20, height: 20 }} />
        PLAY AGAIN
      </motion.button>
    </div>
  );
};
