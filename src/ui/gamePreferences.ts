export const GUIDE_LINES_STORAGE_KEY = 'stackimals-guide-lines';

export function readStoredGuideLines(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_LINES_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function storeGuideLines(enabled: boolean): void {
  try {
    window.localStorage.setItem(GUIDE_LINES_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}
