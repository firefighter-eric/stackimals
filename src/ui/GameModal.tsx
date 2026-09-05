import { useEffect, useRef, type CSSProperties } from 'react';
import type { AnimalId } from '../game/core';
import { getAnimalCopy, getAnimalDefinition, type AnimalDefinition } from '../game/data/animals';
import type { GameActor, GameLanguage, GameSnapshot } from './gameBridge';
import { copyFor } from './i18n';
import { RestartIcon, SparkleIcon } from './icons';
import { GameDialog } from './GameDialog';

interface GameModalProps {
  snapshot: GameSnapshot;
  restartConfirmationOpen: boolean;
  animalRosterOpen: boolean;
  language: GameLanguage;
  guideLinesEnabled: boolean;
  playerAnimalId: AnimalId;
  opponentAnimalId: AnimalId;
  onResume: () => void;
  onOpenAnimalRoster: () => void;
  onCloseAnimalRoster: () => void;
  onRequestRestart: () => void;
  onCancelRestart: () => void;
  onConfirmRestart: () => void;
  onLanguageChange: (language: GameLanguage) => void;
  onGuideLinesChange: (enabled: boolean) => void;
  onPlayerAnimalChange: (animal: AnimalId) => void;
}

interface RosterTileSpec {
  readonly id: AnimalId;
  readonly columns: 2 | 3 | 4;
  readonly rows: 2 | 3 | 4;
}

// Twelve desktop columns make one completely filled 12x10 mosaic. On phones
// the same integer spans flow into six columns, preserving the block logic.
const ROSTER_TILE_LAYOUT = [
  { id: 'elephant', columns: 4, rows: 4 },
  { id: 'giraffe', columns: 2, rows: 4 },
  { id: 'crocodile', columns: 4, rows: 2 },
  { id: 'penguin', columns: 2, rows: 3 },
  { id: 'bear', columns: 4, rows: 4 },
  { id: 'tiger', columns: 4, rows: 4 },
  { id: 'rabbit', columns: 2, rows: 3 },
  { id: 'fox', columns: 3, rows: 2 },
  { id: 'raccoon', columns: 3, rows: 2 },
  { id: 'turtle', columns: 4, rows: 2 },
  { id: 'cat', columns: 2, rows: 2 },
  { id: 'hedgehog', columns: 2, rows: 2 },
  { id: 'frog', columns: 2, rows: 2 },
  { id: 'bird', columns: 2, rows: 2 },
  { id: 'mouse', columns: 4, rows: 2 },
] as const satisfies readonly RosterTileSpec[];

const ANIMAL_ROSTER = ROSTER_TILE_LAYOUT.map((tile) => ({
  ...tile,
  animal: getAnimalDefinition(tile.id),
}));
const ROSTER_SCALE = 0.9;

function rosterImageStyle(animal: AnimalDefinition): CSSProperties {
  return {
    width: Math.round(animal.display.width * ROSTER_SCALE),
    height: Math.round(animal.display.height * ROSTER_SCALE),
  };
}

function rosterCardStyle(columns: number, rows: number): CSSProperties {
  return {
    gridColumn: `span ${columns}`,
    gridRow: `span ${rows}`,
  };
}

function winnerCopy(winner: GameActor | null, language: GameLanguage) {
  const copy = copyFor(language);
  if (winner === 'human') {
    return {
      eyebrow: 'TOWER MASTER',
      title: copy.humanWinnerTitle,
      body: copy.humanWinnerBody,
    };
  }

  return {
    eyebrow: 'GOOD TRY',
    title: copy.aiWinnerTitle,
    body: copy.aiWinnerBody,
  };
}

export function GameModal({
  snapshot,
  restartConfirmationOpen,
  animalRosterOpen,
  language,
  guideLinesEnabled,
  playerAnimalId,
  opponentAnimalId,
  onResume,
  onOpenAnimalRoster,
  onCloseAnimalRoster,
  onRequestRestart,
  onCancelRestart,
  onConfirmRestart,
  onLanguageChange,
  onGuideLinesChange,
  onPlayerAnimalChange,
}: GameModalProps) {
  const copy = copyFor(language);
  const animalRosterRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!animalRosterOpen) {
      return;
    }

    animalRosterRef.current?.scrollTo({ top: 0 });
  }, [animalRosterOpen]);

  const modalOpen =
    restartConfirmationOpen ||
    animalRosterOpen ||
    snapshot.phase === 'paused' ||
    snapshot.phase === 'gameOver' ||
    snapshot.phase === 'error';

  if (!modalOpen) {
    return null;
  }

  if (restartConfirmationOpen) {
    return (
      <GameDialog key="restart" labelledBy="restart-title" role="alertdialog" returnFocusId="request-restart">
        <span className="game-modal__icon game-modal__icon--restart" aria-hidden="true">
          <RestartIcon />
        </span>
        <p className="game-modal__eyebrow">{copy.restartEyebrow}</p>
        <h2 id="restart-title">{copy.restartTitle}</h2>
        <p>{copy.restartBody}</p>
        <div className="game-modal__actions">
          <button type="button" className="modal-button modal-button--secondary" onClick={onCancelRestart}>
            {copy.back}
          </button>
          <button type="button" className="modal-button modal-button--danger" onClick={onConfirmRestart}>
            {copy.restart}
          </button>
        </div>
      </GameDialog>
    );
  }

  if (animalRosterOpen) {
    return (
      <GameDialog key="roster" labelledBy="animal-roster-title" className="game-modal game-modal--roster" backdropClassName="modal-backdrop modal-backdrop--roster" returnFocusId="open-animal-roster">
        <p className="game-modal__eyebrow">{copy.rosterEyebrow}</p>
        <h2 id="animal-roster-title" data-autofocus tabIndex={-1}>{copy.chooseAnimalTitle}</h2>
        <p>{copy.chooseAnimalBody(ANIMAL_ROSTER.length)}</p>
        <ul ref={animalRosterRef} className="animal-roster" aria-label={copy.rosterLabel}>
          {ANIMAL_ROSTER.map(({ animal, columns, rows }) => {
            const animalCopy = getAnimalCopy(animal.id, language);
            const selected = animal.id === playerAnimalId;
            return (
              <li
                className={`animal-roster__card${selected ? ' animal-roster__card--selected' : ''}`}
                data-roster-animal={animal.id}
                data-roster-tile={`${columns}x${rows}`}
                key={animal.id}
                style={rosterCardStyle(columns, rows)}
              >
                <button
                  type="button"
                  className="animal-roster__choice"
                  aria-pressed={selected}
                  aria-label={`${copy.chooseAnimal}: ${animalCopy.name}`}
                  onClick={() => onPlayerAnimalChange(animal.id)}
                >
                  <span className="animal-roster__figure">
                    <img
                      src={animal.texturePath}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      style={rosterImageStyle(animal)}
                    />
                    {selected && <span className="animal-roster__selected">{copy.selected}</span>}
                  </span>
                  <span className="animal-roster__meta">
                    <span className="animal-roster__copy">
                      <span className="animal-roster__headline">
                        <strong>{animalCopy.name}</strong>
                        <small className="animal-roster__size">{animalCopy.sizeLabel}</small>
                      </span>
                      <em>{animalCopy.trait}</em>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="modal-button modal-button--secondary animal-roster__back"
          onClick={onCloseAnimalRoster}
        >
          {copy.backToSettings}
        </button>
      </GameDialog>
    );
  }

  if (snapshot.phase === 'paused') {
    return (
      <GameDialog key="pause" labelledBy="pause-title" returnFocusId="pause-game">
        <div className="logo-plaque game-modal__brand" aria-label={copy.gameTitle}>
          <span className="logo-leaf logo-leaf--left" aria-hidden="true">◆</span>
          <span className="logo-plaque__title">{copy.gameTitle}</span>
          <span className="logo-leaf logo-leaf--right" aria-hidden="true">◆</span>
        </div>
        <p className="game-modal__eyebrow">{copy.settingsEyebrow}</p>
        <h2 id="pause-title">{copy.pausedTitle}</h2>
        <p>{copy.pausedBody}</p>
        <div className="language-setting">
          <span id="language-setting-label">{copy.language}</span>
          <div className="language-setting__options" role="group" aria-labelledby="language-setting-label">
            <button
              type="button"
              className={language === 'zh' ? 'is-active' : ''}
              aria-pressed={language === 'zh'}
              onClick={() => onLanguageChange('zh')}
            >
              {copy.chinese}
            </button>
            <button
              type="button"
              className={language === 'en' ? 'is-active' : ''}
              aria-pressed={language === 'en'}
              onClick={() => onLanguageChange('en')}
            >
              {copy.english}
            </button>
          </div>
        </div>
        <div className="guide-setting">
          <span className="guide-setting__copy">
            <strong id="guide-setting-label">{copy.guideLines}</strong>
            <small>{copy.guideLinesBody}</small>
          </span>
          <button
            type="button"
            className={`guide-setting__toggle${guideLinesEnabled ? ' is-active' : ''}`}
            role="switch"
            aria-checked={guideLinesEnabled}
            aria-labelledby="guide-setting-label"
            onClick={() => onGuideLinesChange(!guideLinesEnabled)}
          >
            <span>{guideLinesEnabled ? copy.guideLinesOn : copy.guideLinesOff}</span>
            <i aria-hidden="true" />
          </button>
        </div>
        <div className="identity-setting">
          <span id="identity-setting-label">{copy.playerIdentity}</span>
          <div className="identity-setting__match" aria-labelledby="identity-setting-label">
            <span className="identity-setting__animal identity-setting__animal--human">
              <img
                src={getAnimalDefinition(playerAnimalId).texturePath}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <small>{copy.you}</small>
              <strong>{getAnimalCopy(playerAnimalId, language).name}</strong>
            </span>
            <b aria-hidden="true">VS</b>
            <span className="identity-setting__animal identity-setting__animal--ai">
              <img
                src={getAnimalDefinition(opponentAnimalId).texturePath}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <small>MILO</small>
              <strong>{getAnimalCopy(opponentAnimalId, language).name}</strong>
            </span>
          </div>
        </div>
        <div className="game-modal__actions game-modal__actions--stacked">
          <button type="button" className="modal-button modal-button--primary" onClick={onResume} data-autofocus>
            {copy.resume}
          </button>
          <button type="button" className="modal-button modal-button--roster" id="open-animal-roster" onClick={onOpenAnimalRoster}>
            <span>{copy.chooseAnimal}</span>
            <small>{copy.viewAnimalGuide(ANIMAL_ROSTER.length)}</small>
          </button>
          <button type="button" className="modal-button modal-button--secondary" id="request-restart" onClick={onRequestRestart}>
            {copy.restart}
          </button>
        </div>
      </GameDialog>
    );
  }

  if (snapshot.phase === 'error') {
    return (
      <GameDialog key="error" labelledBy="error-title" role="alertdialog">
        <p className="game-modal__eyebrow">{copy.loadFailed}</p>
        <h2 id="error-title">{copy.animalsLost}</h2>
        <p>{snapshot.error === 'assets' ? copy.assetLoadFailed : copy.retryBody}</p>
        <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart}>
          {copy.retry}
        </button>
      </GameDialog>
    );
  }

  const winner = winnerCopy(snapshot.winner, language);

  return (
    <GameDialog key="result" labelledBy="result-title" className="game-modal game-modal--result" backdropClassName="modal-backdrop modal-backdrop--celebration">
      <span className="game-modal__icon" aria-hidden="true">
        <SparkleIcon />
      </span>
      <p className="game-modal__eyebrow">{winner.eyebrow}</p>
      <h2 id="result-title">{winner.title}</h2>
      <p>{snapshot.message || winner.body}</p>
      <div className="result-score" aria-label={copy.scoreLabel(snapshot.scoreHuman, snapshot.scoreAi)}>
        <span><small>YOU</small><strong>{snapshot.scoreHuman}</strong></span>
        <i>—</i>
        <span><small>MILO</small><strong>{snapshot.scoreAi}</strong></span>
      </div>
      <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart} data-autofocus>
        {copy.playAgain}
      </button>
    </GameDialog>
  );
}
