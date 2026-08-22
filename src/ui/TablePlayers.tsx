import type { AnimalPreview, GameLanguage, GameSnapshot } from './gameBridge';
import { copyFor } from './i18n';

interface TablePlayersProps {
  playerAnimal: AnimalPreview;
  opponentAnimal: AnimalPreview;
  turn: GameSnapshot['turn'];
  language: GameLanguage;
}

function TablePlayer({
  animal,
  side,
  label,
  isActive,
}: {
  animal: AnimalPreview;
  side: 'human' | 'ai';
  label: string;
  isActive: boolean;
}) {
  return (
    <figure
      className={`table-player table-player--${side}${isActive ? ' table-player--active' : ''}`}
      data-table-player={side}
      data-animal-id={animal.id}
    >
      <span className="table-player__turn" aria-hidden="true">●</span>
      <span className="table-player__figure">
        <img src={animal.assetUrl} alt={animal.name} draggable={false} />
        <i aria-hidden="true" />
      </span>
      <figcaption>
        <small>{label}</small>
        <strong>{animal.name}</strong>
      </figcaption>
    </figure>
  );
}

export function TablePlayers({ playerAnimal, opponentAnimal, turn, language }: TablePlayersProps) {
  const copy = copyFor(language);

  return (
    <aside className="table-players" aria-label={copy.tablePlayersLabel}>
      <TablePlayer
        animal={playerAnimal}
        side="human"
        label={copy.you}
        isActive={turn === 'human'}
      />
      <TablePlayer
        animal={opponentAnimal}
        side="ai"
        label="MILO AI"
        isActive={turn === 'ai'}
      />
    </aside>
  );
}
