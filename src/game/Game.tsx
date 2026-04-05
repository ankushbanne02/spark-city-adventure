import { useGameStore } from '../store/game-store';
import { GameHUD, VoltGuide, NextLevelButton } from '../components/GameUI';
import { StartScreen } from '../components/StartScreen';
import { FinalScreen } from '../components/FinalScreen';
import { Level1Dam } from '../components/levels/Level1Dam';
import { Level2Generator } from '../components/levels/Level2Generator';
import { Level3Transmission } from '../components/levels/Level3Transmission';
import { Level4Substation } from '../components/levels/Level4Substation';
import { Level5House } from '../components/levels/Level5House';
import { Level6Wiring } from '../components/levels/Level6Wiring';
import { Level7Consumption } from '../components/levels/Level7Consumption';
import { Level8SmartHome } from '../components/levels/Level8SmartHome';

function GameContent() {
  const { currentLevel } = useGameStore();

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ width: '100vw', height: '100vh', background: '#f1f5f9' }}
    >
      <div
        className="relative overflow-hidden bg-white"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '1920px',
          maxHeight: '1080px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <GameHUD />
        <VoltGuide />
        <NextLevelButton />

        {currentLevel === 0 && <StartScreen />}
        {currentLevel === 1 && <Level1Dam />}
        {currentLevel === 2 && <Level2Generator />}
        {currentLevel === 3 && <Level3Transmission />}
        {currentLevel === 4 && <Level4Substation />}
        {currentLevel === 5 && <Level5House />}
        {currentLevel === 6 && <Level6Wiring />}
        {currentLevel === 7 && <Level7Consumption />}
        {currentLevel === 8 && <Level8SmartHome />}
        {currentLevel === 9 && <FinalScreen />}
      </div>
    </div>
  );
}

export default function Game() {
  return <GameContent />;
}
