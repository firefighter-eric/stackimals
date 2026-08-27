import Phaser from 'phaser';
import type { GameBridge, GameCommand, GameSnapshot } from '../ui/gameBridge';
import { renderScaleForDevicePixelRatio } from './core/renderResolution';
import { WOOD_SOLVER_ITERATIONS } from './data/woodPhysics';
import { StackimalsScene, STACKIMALS_GAME_SIZE } from './scenes/StackimalsScene';

function configureHighDensityCanvasHost(container: HTMLElement): () => void {
  const stage = container.parentElement;

  if (stage === null) {
    return () => undefined;
  }

  const update = () => {
    const stageBounds = stage.getBoundingClientRect();
    const renderScale = renderScaleForDevicePixelRatio(window.devicePixelRatio);

    container.style.width = `${stageBounds.width * renderScale}px`;
    container.style.height = `${stageBounds.height * renderScale}px`;
    container.style.setProperty('--game-canvas-display-scale', String(1 / renderScale));
  };

  update();

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(update);
  resizeObserver?.observe(stage);
  window.addEventListener('resize', update, { passive: true });

  return () => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', update);
    container.style.removeProperty('width');
    container.style.removeProperty('height');
    container.style.removeProperty('--game-canvas-display-scale');
  };
}

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

    const cleanupHighDensityCanvasHost = configureHighDensityCanvasHost(container);

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
        // Fill the whole responsive stage. The scene camera preserves the
        // fixed game-world scale and exposes any extra space at the sides.
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: STACKIMALS_GAME_SIZE.width,
        height: STACKIMALS_GAME_SIZE.height,
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 1.05 },
          enableSleeping: true,
          // A small contact cushion plus bounded position passes keep detailed
          // compound outlines separated without making the stack buzz from
          // repeated sub-pixel over-correction.
          positionIterations: WOOD_SOLVER_ITERATIONS.position,
          velocityIterations: WOOD_SOLVER_ITERATIONS.velocity,
          constraintIterations: WOOD_SOLVER_ITERATIONS.constraint,
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
      cleanupHighDensityCanvasHost();
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
