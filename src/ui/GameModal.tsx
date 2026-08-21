import { useEffect, useRef, type CSSProperties } from 'react';
import { ANIMALS, getAnimalCopy, type AnimalDefinition } from '../game/data/animals';
import type { GameActor, GameLanguage, GameSnapshot } from './gameBridge';
import { copyFor } from './i18n';
import { RestartIcon, SparkleIcon } from './icons';

interface GameModalProps {
  snapshot: GameSnapshot;
  restartConfirmationOpen: boolean;
  animalRosterOpen: boolean;
  language: GameLanguage;
  onResume: () => void;
  onOpenAnimalRoster: () => void;
  onCloseAnimalRoster: () => void;
  onRequestRestart: () => void;
  onCancelRestart: () => void;
  onConfirmRestart: () => void;
  onLanguageChange: (language: GameLanguage) => void;
}

const ANIMAL_ROSTER = [...ANIMALS].sort((left, right) => (
  Math.max(right.display.width, right.display.height)
  - Math.max(left.display.width, left.display.height)
));
const ROSTER_SCALE = 0.65;

function rosterImageStyle(animal: AnimalDefinition): CSSProperties {
  return {
    width: Math.round(animal.display.width * ROSTER_SCALE),
    height: Math.round(animal.display.height * ROSTER_SCALE),
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
  onResume,
  onOpenAnimalRoster,
  onCloseAnimalRoster,
  onRequestRestart,
  onCancelRestart,
  onConfirmRestart,
  onLanguageChange,
}: GameModalProps) {
  const copy = copyFor(language);
  const animalRosterTitleRef = useRef<HTMLHeadingElement>(null);
  const animalRosterRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!animalRosterOpen) {
      return;
    }

    animalRosterRef.current?.scrollTo({ top: 0 });
    animalRosterTitleRef.current?.focus({ preventScroll: true });
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
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="alertdialog" aria-modal="true" aria-labelledby="restart-title">
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
        </section>
      </div>
    );
  }

  if (animalRosterOpen) {
    return (
      <div className="modal-backdrop modal-backdrop--roster" role="presentation">
        <section
          className="game-modal game-modal--roster"
          role="dialog"
          aria-modal="true"
          aria-labelledby="animal-roster-title"
        >
          <p className="game-modal__eyebrow">{copy.rosterEyebrow}</p>
          <h2 id="animal-roster-title" ref={animalRosterTitleRef} tabIndex={-1}>{copy.animalWarriors}</h2>
          <p>{copy.rosterBody(ANIMAL_ROSTER.length)}</p>
          <ul ref={animalRosterRef} className="animal-roster" aria-label={copy.rosterLabel}>
            {ANIMAL_ROSTER.map((animal) => {
              const animalCopy = getAnimalCopy(animal.id, language);
              return (
              <li className="animal-roster__card" key={animal.id}>
                <span className="animal-roster__figure">
                  <img
                    src={animal.texturePath}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={rosterImageStyle(animal)}
                  />
                  <small className="animal-roster__size">{animalCopy.sizeLabel}</small>
                </span>
                <span className="animal-roster__meta">
                  <span className="animal-roster__copy">
                    <strong>{animalCopy.name}</strong>
                    <em>{animalCopy.trait}</em>
                  </span>
                </span>
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
        </section>
      </div>
    );
  }

  if (snapshot.phase === 'paused') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <span className="game-modal__pause-mark" aria-hidden="true"><i /><i /></span>
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
          <div className="game-modal__actions game-modal__actions--stacked">
            <button type="button" className="modal-button modal-button--primary" onClick={onResume} autoFocus>
              {copy.resume}
            </button>
            <button type="button" className="modal-button modal-button--roster" onClick={onOpenAnimalRoster}>
              <span>{copy.animalWarriors}</span>
              <small>{copy.viewAllAnimals(ANIMAL_ROSTER.length)}</small>
            </button>
            <button type="button" className="modal-button modal-button--secondary" onClick={onRequestRestart}>
              {copy.restart}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (snapshot.phase === 'error') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="game-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title">
          <p className="game-modal__eyebrow">{copy.loadFailed}</p>
          <h2 id="error-title">{copy.animalsLost}</h2>
          <p>{snapshot.message || copy.retryBody}</p>
          <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart}>
            {copy.retry}
          </button>
        </section>
      </div>
    );
  }

  const winner = winnerCopy(snapshot.winner, language);

  return (
    <div className="modal-backdrop modal-backdrop--celebration" role="presentation">
      <section className="game-modal game-modal--result" role="dialog" aria-modal="true" aria-labelledby="result-title">
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
        <button type="button" className="modal-button modal-button--primary" onClick={onConfirmRestart} autoFocus>
          {copy.playAgain}
        </button>
      </section>
    </div>
  );
}
