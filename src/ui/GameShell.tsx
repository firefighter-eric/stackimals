import { useEffect, useRef, useState } from 'react';
import type { GameBridge, GameCommand, GameSnapshot } from './gameBridge';
import { INITIAL_GAME_SNAPSHOT } from './gameBridge';
import { GameControls } from './GameControls';
import { GameHud } from './GameHud';
import { GameModal } from './GameModal';

interface GameShellProps {
  bridge: GameBridge;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('button, a, input, select, textarea, [contenteditable="true"]'));
}

function isPlayablePhase(phase: GameSnapshot['phase']) {
  return phase === 'humanAiming';
}

function statusCopy(snapshot: GameSnapshot) {
  if (snapshot.message) {
    return snapshot.message;
  }

  switch (snapshot.phase) {
    case 'loading':
      return '正在准备动物积木…';
    case 'humanAiming':
      return '拖动动物选择落点';
    case 'humanSettling':
      return '稳住，稳住…';
    case 'aiThinking':
      return 'Milo 正在观察动物塔…';
    case 'aiSettling':
      return 'Milo 的动物正在落下';
    case 'paused':
      return '游戏已暂停';
    case 'gameOver':
      return snapshot.winner === 'human' ? '漂亮的动物塔！' : '再试一次吧！';
    case 'error':
      return '游戏暂时无法继续';
  }
}

export function GameShell({ bridge }: GameShellProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<GameSnapshot>(INITIAL_GAME_SNAPSHOT);
  const restartConfirmationRef = useRef(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_GAME_SNAPSHOT);
  const [restartConfirmationOpen, setRestartConfirmationOpen] = useState(false);

  snapshotRef.current = snapshot;
  restartConfirmationRef.current = restartConfirmationOpen;

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }

    try {
      return bridge.mount(mountNode, setSnapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setSnapshot((current) => ({
        ...current,
        phase: 'error',
        message: `游戏启动失败：${message}`,
      }));
    }
  }, [bridge]);

  useEffect(() => {
    const activeDirections = new Set<-1 | 1>();
    const dispatch = (command: GameCommand) => bridge.dispatch(command);

    const releaseDirections = () => {
      for (const direction of activeDirections) {
        dispatch({ type: 'move', direction, active: false });
      }
      activeDirections.clear();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      const current = snapshotRef.current;
      const canControl = isPlayablePhase(current.phase) && !restartConfirmationRef.current;

      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (event.repeat) {
          return;
        }
        if (restartConfirmationRef.current) {
          setRestartConfirmationOpen(false);
        } else if (current.phase === 'paused') {
          dispatch({ type: 'resume' });
        } else if (current.phase !== 'loading' && current.phase !== 'gameOver' && current.phase !== 'error') {
          dispatch({ type: 'pause' });
        }
        return;
      }

      if (!canControl) {
        return;
      }

      const moveDirection =
        event.code === 'ArrowLeft' || event.code === 'KeyA'
          ? -1
          : event.code === 'ArrowRight' || event.code === 'KeyD'
            ? 1
            : null;

      if (moveDirection !== null) {
        event.preventDefault();
        if (!activeDirections.has(moveDirection)) {
          activeDirections.add(moveDirection);
          dispatch({ type: 'move', direction: moveDirection, active: true });
        }
        return;
      }

      if ((event.code === 'KeyQ' || event.code === 'ArrowDown') && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: -1 });
        return;
      }

      if ((event.code === 'KeyE' || event.code === 'ArrowUp') && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: 1 });
        return;
      }

      if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'drop' });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const direction =
        event.code === 'ArrowLeft' || event.code === 'KeyA'
          ? -1
          : event.code === 'ArrowRight' || event.code === 'KeyD'
            ? 1
            : null;

      if (direction !== null && activeDirections.delete(direction)) {
        event.preventDefault();
        dispatch({ type: 'move', direction, active: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseDirections);

    return () => {
      releaseDirections();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseDirections);
    };
  }, [bridge]);

  const canControl = isPlayablePhase(snapshot.phase) && !restartConfirmationOpen;
  const requestRestart = () => setRestartConfirmationOpen(true);
  const confirmRestart = () => {
    setRestartConfirmationOpen(false);
    bridge.dispatch({ type: 'restart' });
  };

  return (
    <main className="app-viewport">
      <section className="game-shell" aria-label="Stackimals 游戏">
        <GameHud snapshot={snapshot} onPause={() => bridge.dispatch({ type: 'pause' })} />

        <div className="game-stage" data-game-phase={snapshot.phase}>
          <div
            ref={mountRef}
            className="game-stage__mount"
            id="stackimals-game"
            aria-label="动物堆叠游戏区域"
          />

          {snapshot.phase === 'loading' && (
            <div className="loading-indicator" role="status">
              <span aria-hidden="true" />
              正在召集动物…
            </div>
          )}

          <div className={`stage-message stage-message--${snapshot.turn}`} aria-live="polite">
            <span aria-hidden="true" />
            {statusCopy(snapshot)}
          </div>
        </div>

        <GameControls
          enabled={canControl}
          onRotate={(direction) => bridge.dispatch({ type: 'rotate', direction })}
          onDrop={() => bridge.dispatch({ type: 'drop' })}
        />

        <GameModal
          snapshot={snapshot}
          restartConfirmationOpen={restartConfirmationOpen}
          onResume={() => bridge.dispatch({ type: 'resume' })}
          onRequestRestart={requestRestart}
          onCancelRestart={() => setRestartConfirmationOpen(false)}
          onConfirmRestart={confirmRestart}
        />

        <div className="rotate-device" role="status">
          <span aria-hidden="true">↻</span>
          <strong>请竖屏游玩</strong>
          <small>这样动物们有更多空间往上堆</small>
        </div>
      </section>
    </main>
  );
}
