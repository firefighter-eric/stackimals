import Phaser from 'phaser';
import { createInitialGameSnapshot, type GameBridge, type GameCommand, type GameSnapshot } from '../ui/gameBridge';
import { renderScaleForDevicePixelRatio } from './core/renderResolution';
import { WOOD_RUNNER, WOOD_SOLVER_ITERATIONS } from './data/woodPhysics';
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

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(update);
  resizeObserver?.observe(stage);
  update();
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
  private scene: StackimalsScene | null = null;
  private queuedCommands: GameCommand[] = [];
  private dispose: (() => void) | null = null;

  mount(container: HTMLElement, publishSnapshot: (snapshot: GameSnapshot) => void): () => void {
    this.dispose?.();

    let active = true;
    let game: Phaser.Game | null = null;
    let startupTimer: number | undefined;
    let cleanupHost = () => {};
    const cleanup = () => {
      if (!active) return;
      active = false;
      window.clearTimeout(startupTimer);
      this.queuedCommands = [];
      this.scene = null;
      game?.destroy(true);
      container.replaceChildren();
      cleanupHost();
      this.dispose = null;
    };
    this.dispose = cleanup;

    const failAssets = () => {
      if (!active) return;
      cleanup();
      publishSnapshot({ ...createInitialGameSnapshot('zh'), phase: 'error', error: 'assets' });
    };

    try {
      cleanupHost = configureHighDensityCanvasHost(container);
      const scene = new StackimalsScene({
        publish: (snapshot) => { if (active) publishSnapshot(snapshot); },
        failed: failAssets,
        ready: (readyScene) => {
          if (!active) return;
          window.clearTimeout(startupTimer);
          this.scene = readyScene;
          const queued = this.queuedCommands;
          this.queuedCommands = [];
          queued.forEach((command) => readyScene.handleCommand(command));
        },
        stopped: (stoppedScene) => {
          if (active && this.scene === stoppedScene) {
            this.scene = null;
          }
        },
      });

      const debugPhysics = import.meta.env.DEV && new URLSearchParams(window.location.search).has('debugPhysics');

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: STACKIMALS_GAME_SIZE.width,
        height: STACKIMALS_GAME_SIZE.height,
        transparent: true,
        backgroundColor: 'rgba(0,0,0,0)',
        loader: { maxRetries: 0 },
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
            runner: { ...WOOD_RUNNER },
            debug: debugPhysics,
          },
        },
        scene,
        input: {
          activePointers: 2,
          touch: { capture: true },
        },
      });
      // Bound the entire startup, including texture decoding and browsers that
      // do not advance an XHR timeout while a request is stalled/intercepted.
      startupTimer = window.setTimeout(failAssets, 15_000);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
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
