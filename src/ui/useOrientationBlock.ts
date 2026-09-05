import { useEffect, useState } from 'react';

export const BLOCKED_ORIENTATION = '(orientation: landscape) and (max-height: 520px) and (max-width: 940px)';

export function useOrientationBlock(): boolean {
  const [blocked, setBlocked] = useState(() => window.matchMedia(BLOCKED_ORIENTATION).matches);
  useEffect(() => {
    const query = window.matchMedia(BLOCKED_ORIENTATION);
    const update = () => setBlocked(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return blocked;
}
