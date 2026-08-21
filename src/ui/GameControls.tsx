import { RotateLeftIcon, RotateRightIcon } from './icons';

interface GameControlsProps {
  enabled: boolean;
  onRotate: (direction: -1 | 1) => void;
  onDrop: () => void;
}

export function GameControls({ enabled, onRotate, onDrop }: GameControlsProps) {
  return (
    <footer className="game-controls" aria-label="游戏控制">
      <button
        className="control-button control-button--rotate"
        type="button"
        disabled={!enabled}
        onClick={() => onRotate(-1)}
        aria-label="向左旋转"
      >
        <RotateLeftIcon />
      </button>

      <button
        className="control-button control-button--drop"
        type="button"
        disabled={!enabled}
        onClick={onDrop}
      >
        投放
      </button>

      <button
        className="control-button control-button--rotate"
        type="button"
        disabled={!enabled}
        onClick={() => onRotate(1)}
        aria-label="向右旋转"
      >
        <RotateRightIcon />
      </button>
    </footer>
  );
}
