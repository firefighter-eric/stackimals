import { useEffect, useRef, type ReactNode } from 'react';
import { RotateLeftIcon, RotateRightIcon } from './icons';
import type { GameLanguage } from './gameBridge';
import { copyFor } from './i18n';

type Direction = -1 | 1;

function HoldButton({ enabled, label, shortcut, onChange, children, move = false }: {
  enabled: boolean;
  label: string;
  shortcut: string;
  onChange: (active: boolean) => void;
  children: ReactNode;
  move?: boolean;
}) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const activeInputs = useRef(new Set<string>());
  const setInput = (input: string, active: boolean) => {
    const wasActive = activeInputs.current.size > 0;
    if (active) activeInputs.current.add(input);
    else activeInputs.current.delete(input);
    const isActive = activeInputs.current.size > 0;
    if (wasActive !== isActive) changeRef.current(isActive);
  };
  const release = () => {
    activeInputs.current.clear();
    changeRef.current(false);
  };
  useEffect(() => {
    const releaseAll = () => {
      activeInputs.current.clear();
      changeRef.current(false);
    };
    if (!enabled) releaseAll();
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [enabled]);

  return (
    <button
      className={`control-button control-button--rotate${move ? ' control-button--move' : ''}`}
      type="button"
      disabled={!enabled}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setInput(`pointer-${event.pointerId}`, true);
      }}
      onPointerUp={(event) => {
        setInput(`pointer-${event.pointerId}`, false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => setInput(`pointer-${event.pointerId}`, false)}
      onLostPointerCapture={(event) => setInput(`pointer-${event.pointerId}`, false)}
      onKeyDown={(event) => {
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          setInput(event.code, true);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          setInput(event.code, false);
        }
      }}
      onClick={(event) => {
        // Assistive technology can activate a button without key/pointer events.
        if (event.detail === 0 && activeInputs.current.size === 0) {
          changeRef.current(true);
          changeRef.current(false);
        }
      }}
      onBlur={release}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      title={`${shortcut} · ${label}`}
    >
      {children}
    </button>
  );
}

export function GameControls({ language, enabled, inert, onMove, onRotate, onDrop }: {
  language: GameLanguage;
  enabled: boolean;
  inert: boolean;
  onMove: (direction: Direction, active: boolean) => void;
  onRotate: (direction: Direction, active: boolean) => void;
  onDrop: () => void;
}) {
  const copy = copyFor(language);
  return (
    <footer className="game-controls" aria-label={copy.controls} inert={inert}>
      <HoldButton enabled={enabled} label={copy.moveLeft} shortcut="A" onChange={(active) => onMove(-1, active)} move>
        <span aria-hidden="true">←</span>
      </HoldButton>
      <HoldButton enabled={enabled} label={copy.rotateLeft} shortcut="Q" onChange={(active) => onRotate(-1, active)}>
        <RotateLeftIcon />
      </HoldButton>
      <button className="control-button control-button--drop" type="button" disabled={!enabled}
        onClick={onDrop} aria-keyshortcuts="Space" title={`Space · ${copy.drop}`}>
        {copy.drop}
      </button>
      <HoldButton enabled={enabled} label={copy.rotateRight} shortcut="E" onChange={(active) => onRotate(1, active)}>
        <RotateRightIcon />
      </HoldButton>
      <HoldButton enabled={enabled} label={copy.moveRight} shortcut="D" onChange={(active) => onMove(1, active)} move>
        <span aria-hidden="true">→</span>
      </HoldButton>
    </footer>
  );
}
