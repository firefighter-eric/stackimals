import { useLayoutEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Shared focus and restoration contract for every blocking game overlay. */
export function GameDialog({
  children,
  labelledBy,
  role = 'dialog',
  className = 'game-modal',
  backdropClassName = 'modal-backdrop',
  returnFocusId,
}: {
  children: ReactNode;
  labelledBy: string;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  backdropClassName?: string;
  returnFocusId?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : null;
    const previousId = previous?.id;
    const focusables = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'));
    const initial = panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? panel;
    initial.focus({ preventScroll: true });

    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) {
        (focusables()[0] ?? panel).focus({ preventScroll: true });
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const elements = focusables();
      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      const nextIndex = currentIndex < 0
        ? event.shiftKey ? elements.length - 1 : 0
        : (currentIndex + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
      // WebKit may omit buttons from native Tab navigation depending on OS
      // keyboard settings, so contain every Tab step, not only the endpoints.
      (elements[nextIndex] ?? panel).focus();
    };
    document.addEventListener('focusin', containFocus);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('keydown', onKeyDown, true);
      // Wait for React to remove inert and restore a parent dialog's controls.
      queueMicrotask(() => {
        if (panel.isConnected) return;
        const target = (returnFocusId ? document.getElementById(returnFocusId) : null)
          ?? (previous?.isConnected ? previous : previousId ? document.getElementById(previousId) : null);
        if (target && !target.closest('[inert]') && !target.matches(':disabled')) {
          target.focus({ preventScroll: true });
        } else if (!document.querySelector('[aria-modal="true"]')) {
          document.getElementById('stackimals-game')?.focus({ preventScroll: true });
        }
      });
    };
  }, [labelledBy, returnFocusId]);

  return (
    <div className={backdropClassName} role="presentation">
      <section ref={panelRef} className={className} role={role} aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </section>
    </div>
  );
}
