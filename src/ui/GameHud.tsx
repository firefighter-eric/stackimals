import type { AnimalPreview, GameLanguage, GameSnapshot } from './gameBridge';
import { PauseIcon } from './icons';
import { copyFor } from './i18n';

interface GameHudProps {
  snapshot: GameSnapshot;
  language: GameLanguage;
  playerAnimal: AnimalPreview;
  opponentAnimal: AnimalPreview;
  onPause: () => void;
  onSwap: () => void;
}

interface AnimalQueueProps {
  animals: readonly AnimalPreview[];
  label: string;
  align: 'left' | 'right';
}

function AnimalQueue({ animals, label, align }: AnimalQueueProps) {
  return (
    <div className={`animal-queue animal-queue--${align}`} aria-label={label}>
      {animals.slice(0, 3).map((animal, index) => (
        <div
          className="animal-queue__item"
          key={`${animal.id}-${index}`}
          title={animal.name}
        >
          <img src={animal.assetUrl} alt={animal.name} draggable={false} />
        </div>
      ))}
    </div>
  );
}

function AvatarCard({
  label,
  assetUrl,
  isActive,
  score,
  placedLabel,
  swapsRemaining,
  swapsLabel,
}: {
  label: string;
  assetUrl: string;
  isActive: boolean;
  score: number;
  placedLabel: (score: number) => string;
  swapsRemaining: number;
  swapsLabel: (remaining: number) => string;
}) {
  return (
    <div className={`avatar-card${isActive ? ' avatar-card--active' : ''}`}>
      <div className="avatar-card__portrait">
        <img src={assetUrl} alt="" draggable={false} />
        <span className="avatar-card__score" aria-label={placedLabel(score)}>
          {score}
        </span>
        <span className="avatar-card__swaps" aria-label={swapsLabel(swapsRemaining)}>
          ↻{swapsRemaining}
        </span>
      </div>
      <span>{label}</span>
    </div>
  );
}

function TurnLight({ snapshot, language }: { snapshot: GameSnapshot; language: GameLanguage }) {
  const humanIsActive = snapshot.turn === 'human';
  const copy = copyFor(language);

  return (
    <div className="turn-status" aria-label={humanIsActive ? copy.yourTurn : copy.miloTurn}>
      <span className={`turn-light turn-light--human${humanIsActive ? ' is-active' : ''}`} />
      <span className={`turn-light turn-light--ai${humanIsActive ? '' : ' is-active'}`} />
    </div>
  );
}

export function GameHud({ snapshot, language, playerAnimal, opponentAnimal, onPause, onSwap }: GameHudProps) {
  const copy = copyFor(language);
  const pauseDisabled =
    snapshot.phase === 'loading' ||
    snapshot.phase === 'gameOver' ||
    snapshot.phase === 'error';

  return (
    <header className="game-hud">
      <div className="game-hud__title-row">
        <button
          className="icon-button pause-button"
          type="button"
          onClick={onPause}
          disabled={pauseDisabled}
          aria-label={copy.pauseGame}
        >
          <PauseIcon />
        </button>

        <div className="logo-plaque" aria-label={copy.gameTitle}>
          <span className="logo-leaf logo-leaf--left" aria-hidden="true">◆</span>
          <span className="logo-plaque__title">{copy.gameTitle}</span>
          <span className="logo-leaf logo-leaf--right" aria-hidden="true">◆</span>
        </div>

        <div className="game-hud__round" aria-label={copy.roundLabel(snapshot.round)}>
          <span>{copy.round}</span>
          <strong>{snapshot.round}</strong>
        </div>
      </div>

      <div className="scoreboard">
        <AvatarCard
          label={copy.you}
          assetUrl={playerAnimal.assetUrl}
          score={snapshot.scoreHuman}
          isActive={snapshot.turn === 'human'}
          placedLabel={copy.placedCount}
          swapsRemaining={snapshot.swapsHuman}
          swapsLabel={copy.swapsRemaining}
        />

        <AnimalQueue animals={snapshot.upcomingHuman} label={copy.yourQueue} align="left" />
        <TurnLight snapshot={snapshot} language={language} />
        <AnimalQueue animals={snapshot.upcomingAi} label={copy.miloQueue} align="right" />

        <AvatarCard
          label="MILO AI"
          assetUrl={opponentAnimal.assetUrl}
          score={snapshot.scoreAi}
          isActive={snapshot.turn === 'ai'}
          placedLabel={copy.placedCount}
          swapsRemaining={snapshot.swapsAi}
          swapsLabel={copy.swapsRemaining}
        />
      </div>

      <div
        className="next-animal"
        aria-live="polite"
        aria-label={language === 'zh'
          ? `${snapshot.currentAnimal.name}，${snapshot.currentAnimal.trait}：${snapshot.currentAnimal.tip}`
          : `${snapshot.currentAnimal.name}, ${snapshot.currentAnimal.trait}: ${snapshot.currentAnimal.tip}`}
      >
        <img src={snapshot.currentAnimal.assetUrl} alt="" draggable={false} />
        <span className="next-animal__copy">
          <small>{copy.nextAnimal} · {snapshot.turn === 'human' ? copy.you : 'Milo'}</small>
          <strong>{snapshot.currentAnimal.name}</strong>
        </span>
        <span className="next-animal__meta">
          <em>{snapshot.currentAnimal.trait}</em>
          {snapshot.turn === 'human' && (
            <button
              className="next-animal__swap"
              type="button"
              disabled={snapshot.phase !== 'humanAiming' || snapshot.swapsHuman <= 0}
              onClick={onSwap}
              aria-keyshortcuts="R"
              title={`R · ${copy.swapAnimal}`}
              aria-label={copy.swapAnimalWithCount(snapshot.swapsHuman)}
            >
              {copy.swapAnimal}
              <strong>{snapshot.swapsHuman}</strong>
            </button>
          )}
        </span>
      </div>
    </header>
  );
}
