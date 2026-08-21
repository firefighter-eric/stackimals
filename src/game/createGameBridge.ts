import Phaser from 'phaser';
import type { GameBridge, GameCommand, GameSnapshot } from '../ui/gameBridge';
import { StackimalsScene, STACKIMALS_GAME_SIZE } from './scenes/StackimalsScene';

class PhaserGameBridge implements GameBridge {
  private game: Phaser.Game | null = null;
  private scene: StackimalsScene | null = null;
  private queuedCommands: GameCommand[] = [];

  mount(container: HTMLElement, publishSnapshot: (snapshot: GameSnapshot) => void): () => void {
    if (this.game !== null) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }

    const scene = new StackimalsScene({
      publish: publishSnapshot,
      ready: (readyScene) => {
        this.scene = readyScene;
        const queued = this.queuedCommands;
        this.queuedCommands = [];
        queued.forEach((command) => readyScene.handleCommand(command));
      },
      stopped: (stoppedScene) => {
        if (this.scene === stoppedScene) {
          this.scene = null;
        }
      },
    });

    const debugPhysics = import.meta.env.DEV && new URLSearchParams(window.location.search).has('debugPhysics');

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: STACKIMALS_GAME_SIZE.width,
      height: STACKIMALS_GAME_SIZE.height,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'high-performance',
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: STACKIMALS_GAME_SIZE.width,
        height: STACKIMALS_GAME_SIZE.height,
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 1.05 },
          enableSleeping: true,
          // Stacking exposes even small solver penetration. A few extra
          // iterations keep resting outlines visually separated without
          // changing the game's fixed 60 Hz simulation cadence.
          positionIterations: 10,
          velocityIterations: 8,
          constraintIterations: 4,
          runner: {
            fps: 60,
            maxUpdates: 3,
            maxFrameTime: 50,
          },
          debug: debugPhysics,
        },
      },
      scene,
      input: {
        activePointers: 2,
        touch: { capture: true },
      },
    });

    let cleaned = false;
    return () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      this.queuedCommands = [];
      this.scene = null;
      this.game?.destroy(true);
      this.game = null;
      container.replaceChildren();
    };
  }

  dispatch(command: GameCommand): void {
    if (this.scene === null) {
      this.queuedCommands.push(command);
      return;
    }
    this.scene.handleCommand(command);
  }
}

export function createStackimalsGameBridge(): GameBridge {
  return new PhaserGameBridge();
}
