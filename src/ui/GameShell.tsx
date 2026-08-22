import { useEffect, useRef, useState } from 'react';
import type { AnimalId, GameBridge, GameCommand, GameLanguage, GameSnapshot } from './gameBridge';
import { createInitialGameSnapshot, getAnimalPreview } from './gameBridge';
import { GameControls } from './GameControls';
import { GameHud } from './GameHud';
import { GameModal } from './GameModal';
import { copyFor, readStoredLanguage, storeLanguage } from './i18n';
import {
  opponentAnimalFor,
  readStoredPlayerAnimal,
  storePlayerAnimal,
} from './playerIdentity';
import { TablePlayers } from './TablePlayers';

interface GameShellProps {
  bridge: GameBridge;
}

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

function isPlayablePhase(phase: GameSnapshot['phase']) {
  return phase === 'humanAiming';
}

function statusCopy(snapshot: GameSnapshot, language: GameLanguage) {
  if (snapshot.message) {
    return snapshot.message;
  }

  const copy = copyFor(language);
  switch (snapshot.phase) {
    case 'loading':
      return copy.loadingStatus;
    case 'humanAiming':
      return copy.aimStatus;
    case 'humanSettling':
      return copy.humanSettlingStatus;
    case 'aiThinking':
      return copy.aiThinkingStatus;
    case 'aiSettling':
      return copy.aiSettlingStatus;
    case 'paused':
      return copy.pausedStatus;
    case 'gameOver':
      return snapshot.winner === 'human' ? copy.humanWinStatus : copy.aiWinStatus;
    case 'error':
      return copy.errorStatus;
  }
}

export function GameShell({ bridge }: GameShellProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<GameLanguage>(() => readStoredLanguage());
  const [playerAnimalId, setPlayerAnimalId] = useState<AnimalId>(() => readStoredPlayerAnimal());
  const initialSnapshotRef = useRef<GameSnapshot>(createInitialGameSnapshot(language));
  const snapshotRef = useRef<GameSnapshot>(initialSnapshotRef.current);
  const languageRef = useRef(language);
  const restartConfirmationRef = useRef(false);
  const animalRosterRef = useRef(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshotRef.current);
  const [restartConfirmationOpen, setRestartConfirmationOpen] = useState(false);
  const [animalRosterOpen, setAnimalRosterOpen] = useState(false);

  snapshotRef.current = snapshot;
  languageRef.current = language;
  restartConfirmationRef.current = restartConfirmationOpen;
  animalRosterRef.current = animalRosterOpen;

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) {
      return;
    }

    try {
      return bridge.mount(mountNode, setSnapshot);
    } catch (error) {
      const copy = copyFor(languageRef.current);
      const message = error instanceof Error ? error.message : copy.unknownError;
      setSnapshot((current) => ({
        ...current,
        phase: 'error',
        message: copy.startupFailed(message),
      }));
    }
  }, [bridge]);

  useEffect(() => {
    const copy = copyFor(language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = copy.gameTitle;
    storeLanguage(language);
    setSnapshot((current) => ({
      ...current,
      language,
      currentAnimal: getAnimalPreview(current.currentAnimal.id, language),
      upcomingHuman: current.upcomingHuman.map((animal) => getAnimalPreview(animal.id, language)),
      upcomingAi: current.upcomingAi.map((animal) => getAnimalPreview(animal.id, language)),
    }));
    bridge.dispatch({ type: 'setLanguage', language });
  }, [bridge, language]);

  useEffect(() => {
    storePlayerAnimal(playerAnimalId);
  }, [playerAnimalId]);

  useEffect(() => {
    const activeMoves = new Set<-1 | 1>();
    const activeRotations = new Set<-1 | 1>();
    const dispatch = (command: GameCommand) => bridge.dispatch(command);

    const releaseControls = () => {
      for (const direction of activeMoves) {
        dispatch({ type: 'move', direction, active: false });
      }
      for (const direction of activeRotations) {
        dispatch({ type: 'rotate', direction, active: false });
      }
      activeMoves.clear();
      activeRotations.clear();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && animalRosterRef.current) {
        event.preventDefault();
        if (!event.repeat) {
          setAnimalRosterOpen(false);
        }
        return;
      }

      if (isTextEntryTarget(event.target)) {
        return;
      }

      const current = snapshotRef.current;
      const canControl =
        isPlayablePhase(current.phase) &&
        !restartConfirmationRef.current &&
        !animalRosterRef.current;

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
        if (!activeMoves.has(moveDirection)) {
          activeMoves.add(moveDirection);
          dispatch({ type: 'move', direction: moveDirection, active: true });
        }
        return;
      }

      const rotationDirection =
        event.code === 'KeyQ' || event.code === 'ArrowDown'
          ? -1
          : event.code === 'KeyE' || event.code === 'ArrowUp'
            ? 1
            : null;

      if (rotationDirection !== null) {
        event.preventDefault();
        if (!activeRotations.has(rotationDirection)) {
          activeRotations.add(rotationDirection);
          dispatch({ type: 'rotate', direction: rotationDirection, active: true });
        }
        return;
      }

      if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'drop' });
        return;
      }

      if (event.code === 'KeyR' && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'swap' });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const moveDirection =
        event.code === 'ArrowLeft' || event.code === 'KeyA'
          ? -1
          : event.code === 'ArrowRight' || event.code === 'KeyD'
            ? 1
            : null;

      if (moveDirection !== null && activeMoves.delete(moveDirection)) {
        event.preventDefault();
        dispatch({ type: 'move', direction: moveDirection, active: false });
      }

      const rotationDirection =
        event.code === 'KeyQ' || event.code === 'ArrowDown'
          ? -1
          : event.code === 'KeyE' || event.code === 'ArrowUp'
            ? 1
            : null;

      if (rotationDirection !== null && activeRotations.delete(rotationDirection)) {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: rotationDirection, active: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseControls);

    return () => {
      releaseControls();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseControls);
    };
  }, [bridge]);

  const canControl = isPlayablePhase(snapshot.phase) && !restartConfirmationOpen && !animalRosterOpen;
  const requestRestart = () => setRestartConfirmationOpen(true);
  const resumeGame = () => {
    setAnimalRosterOpen(false);
    bridge.dispatch({ type: 'resume' });
  };
  const confirmRestart = () => {
    setRestartConfirmationOpen(false);
    setAnimalRosterOpen(false);
    bridge.dispatch({ type: 'restart' });
  };
  const copy = copyFor(language);
  const playerAnimal = getAnimalPreview(playerAnimalId, language);
  const opponentAnimal = getAnimalPreview(opponentAnimalFor(playerAnimalId), language);

  return (
    <main className="app-viewport">
      <section className="game-shell" aria-label={copy.appLabel}>
        <GameHud
          snapshot={snapshot}
          language={language}
          playerAnimal={playerAnimal}
          opponentAnimal={opponentAnimal}
          onPause={() => bridge.dispatch({ type: 'pause' })}
          onSwap={() => bridge.dispatch({ type: 'swap' })}
        />

        <div className="game-stage" data-game-phase={snapshot.phase}>
          <div
            ref={mountRef}
            className="game-stage__mount"
            id="stackimals-game"
            aria-label={copy.stageLabel}
          />

          <TablePlayers
            playerAnimal={playerAnimal}
            opponentAnimal={opponentAnimal}
            turn={snapshot.turn}
            language={language}
          />

          {snapshot.phase === 'loading' && (
            <div className="loading-indicator" role="status">
              <span aria-hidden="true" />
              {copy.loading}
            </div>
          )}

          <div className={`stage-message stage-message--${snapshot.turn}`} aria-live="polite">
            <span aria-hidden="true" />
            {statusCopy(snapshot, language)}
          </div>
        </div>

        <GameControls
          language={language}
          enabled={canControl}
          onRotate={(direction, active) => bridge.dispatch({ type: 'rotate', direction, active })}
          onDrop={() => bridge.dispatch({ type: 'drop' })}
        />

        <GameModal
          snapshot={snapshot}
          restartConfirmationOpen={restartConfirmationOpen}
          animalRosterOpen={animalRosterOpen}
          language={language}
          playerAnimalId={playerAnimalId}
          opponentAnimalId={opponentAnimal.id}
          onResume={resumeGame}
          onOpenAnimalRoster={() => setAnimalRosterOpen(true)}
          onCloseAnimalRoster={() => setAnimalRosterOpen(false)}
          onRequestRestart={requestRestart}
          onCancelRestart={() => setRestartConfirmationOpen(false)}
          onConfirmRestart={confirmRestart}
          onLanguageChange={setLanguage}
          onPlayerAnimalChange={setPlayerAnimalId}
        />

        <div className="rotate-device" role="status">
          <span aria-hidden="true">↻</span>
          <strong>{copy.portraitTitle}</strong>
          <small>{copy.portraitBody}</small>
        </div>
      </section>
    </main>
  );
}
