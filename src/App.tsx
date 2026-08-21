import { createStackimalsGameBridge } from './game/createGameBridge';
import { GameShell } from './ui/GameShell';

const gameBridge = createStackimalsGameBridge();

export default function App() {
  return <GameShell bridge={gameBridge} />;
}
