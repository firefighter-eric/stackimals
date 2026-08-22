export const MAX_GAME_RENDER_SCALE = 2;

/**
 * Uses extra backing pixels on high-density screens without letting very high
 * mobile DPR values multiply the WebGL fill cost beyond what this game needs.
 */
export function renderScaleForDevicePixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 1) {
    return 1;
  }

  return Math.min(devicePixelRatio, MAX_GAME_RENDER_SCALE);
}
