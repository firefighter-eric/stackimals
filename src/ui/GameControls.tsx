import { RotateLeftIcon, RotateRightIcon } from './icons';
import type { GameLanguage } from './gameBridge';
import { copyFor } from './i18n';

interface GameControlsProps {
  language: GameLanguage;
  enabled: boolean;
  onRotate: (direction: -1 | 1) => void;
  onDrop: () => void;
}

export function GameControls({ language, enabled, onRotate, onDrop }: GameControlsProps) {
  const copy = copyFor(language);

  return (
    <footer className="game-controls" aria-label={copy.controls}>
      <button
        className="control-button control-button--rotate"
        type="button"
        disabled={!enabled}
        onClick={() => onRotate(-1)}
        aria-label={copy.rotateLeft}
      >
        <RotateLeftIcon />
      </button>

      <button
        className="control-button control-button--drop"
        type="button"
        disabled={!enabled}
        onClick={onDrop}
      >
        {copy.drop}
      </button>

      <button
        className="control-button control-button--rotate"
        type="button"
        disabled={!enabled}
        onClick={() => onRotate(1)}
        aria-label={copy.rotateRight}
      >
        <RotateRightIcon />
      </button>
    </footer>
  );
}
