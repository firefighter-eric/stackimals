import type { AnimalPreview, GameSnapshot } from './gameBridge';
import { PauseIcon } from './icons';

interface GameHudProps {
  snapshot: GameSnapshot;
  onPause: () => void;
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
}: {
  label: string;
  assetUrl: string;
  isActive: boolean;
  score: number;
}) {
  return (
    <div className={`avatar-card${isActive ? ' avatar-card--active' : ''}`}>
      <div className="avatar-card__portrait">
        <img src={assetUrl} alt="" draggable={false} />
        <span className="avatar-card__score" aria-label={`${score} 个已放置`}>
          {score}
        </span>
      </div>
      <span>{label}</span>
    </div>
  );
}

function TurnLight({ snapshot }: { snapshot: GameSnapshot }) {
  const humanIsActive = snapshot.turn === 'human';

  return (
    <div className="turn-status" aria-label={humanIsActive ? '你的回合' : 'Milo AI 的回合'}>
      <span className={`turn-light turn-light--human${humanIsActive ? ' is-active' : ''}`} />
      <span className={`turn-light turn-light--ai${humanIsActive ? '' : ' is-active'}`} />
    </div>
  );
}

export function GameHud({ snapshot, onPause }: GameHudProps) {
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
          aria-label="暂停游戏"
        >
          <PauseIcon />
        </button>

        <div className="logo-plaque" aria-label="Stackimals">
          <span className="logo-leaf logo-leaf--left" aria-hidden="true">◆</span>
          <span>STACKIMALS</span>
          <span className="logo-leaf logo-leaf--right" aria-hidden="true">◆</span>
        </div>

        <div className="game-hud__round" aria-label={`第 ${snapshot.round} 回合`}>
          <span>回合</span>
          <strong>{snapshot.round}</strong>
        </div>
      </div>

      <div className="scoreboard">
        <AvatarCard
          label="YOU"
          assetUrl="/assets/game/animals/fox.webp"
          score={snapshot.scoreHuman}
          isActive={snapshot.turn === 'human'}
        />

        <AnimalQueue animals={snapshot.upcomingHuman} label="你接下来的动物" align="left" />
        <TurnLight snapshot={snapshot} />
        <AnimalQueue animals={snapshot.upcomingAi} label="Milo 接下来的动物" align="right" />

        <AvatarCard
          label="MILO AI"
          assetUrl="/assets/game/animals/bear.webp"
          score={snapshot.scoreAi}
          isActive={snapshot.turn === 'ai'}
        />
      </div>

      <div className="next-animal" aria-live="polite">
        <img src={snapshot.currentAnimal.assetUrl} alt="" draggable={false} />
        <span>下一只 · {snapshot.turn === 'human' ? '你' : 'Milo'}</span>
        <strong>{snapshot.currentAnimal.name}</strong>
      </div>
    </header>
  );
}
