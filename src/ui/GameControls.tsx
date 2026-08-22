import { RotateLeftIcon, RotateRightIcon } from './icons';
import type { GameLanguage } from './gameBridge';
import { copyFor } from './i18n';

interface GameControlsProps {
  language: GameLanguage;
  enabled: boolean;
  onRotate: (direction: -1 | 1, active: boolean) => void;
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
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onRotate(-1, true);
        }}
        onPointerUp={(event) => {
          onRotate(-1, false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => onRotate(-1, false)}
        onLostPointerCapture={() => onRotate(-1, false)}
        onBlur={() => onRotate(-1, false)}
        aria-label={copy.rotateLeft}
        aria-keyshortcuts="Q"
        title={`Q · ${copy.rotateLeft}`}
      >
        <RotateLeftIcon />
      </button>

      <button
        className="control-button control-button--drop"
        type="button"
        disabled={!enabled}
        onClick={onDrop}
        aria-keyshortcuts="Space"
        title={`Space · ${copy.drop}`}
      >
        {copy.drop}
      </button>

      <button
        className="control-button control-button--rotate"
        type="button"
        disabled={!enabled}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onRotate(1, true);
        }}
        onPointerUp={(event) => {
          onRotate(1, false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => onRotate(1, false)}
        onLostPointerCapture={() => onRotate(1, false)}
        onBlur={() => onRotate(1, false)}
        aria-label={copy.rotateRight}
        aria-keyshortcuts="E"
        title={`E · ${copy.rotateRight}`}
      >
        <RotateRightIcon />
      </button>
    </footer>
  );
}
