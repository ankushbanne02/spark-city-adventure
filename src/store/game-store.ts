import { create } from 'zustand';

interface GameState {
  currentLevel: number;
  score: number;
  stars: number;
  voltMessage: string;
  levelComplete: boolean;

  setLevel: (level: number) => void;
  nextLevel: () => void;
  addScore: (points: number) => void;
  addStar: () => void;
  setVoltMessage: (msg: string) => void;
  setLevelComplete: (status: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentLevel: 0,
  score: 0,
  stars: 0,
  voltMessage: "Welcome to Spark City Adventure! Ready to learn about electricity?",
  levelComplete: false,

  setLevel: (level) => set({ currentLevel: level, levelComplete: false }),

  nextLevel: () => set((state) => ({
    currentLevel: state.currentLevel + 1,
    levelComplete: false,
    score: state.score + 50,
  })),

  addScore: (points) => set((state) => ({ score: Math.max(0, state.score + points) })),

  addStar: () => set((state) => ({ stars: Math.min(8, state.stars + 1) })),

  setVoltMessage: (msg) => set({ voltMessage: msg }),

  setLevelComplete: (status) => set({ levelComplete: status }),

  resetGame: () => set({
    currentLevel: 0,
    score: 0,
    stars: 0,
    voltMessage: "Welcome back! Let's power up the city!",
    levelComplete: false,
  }),
}));
