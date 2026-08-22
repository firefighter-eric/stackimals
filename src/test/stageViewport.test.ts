import { describe, expect, it } from 'vitest';

import { fitStageViewport } from '../game/core/stageViewport';

const GAME_WORLD = { width: 390, height: 620 } as const;

describe('responsive stage viewport', () => {
  it('keeps the complete game world visible on a narrow screen', () => {
    const fit = fitStageViewport({ width: 390, height: 560 }, GAME_WORLD);

    expect(fit.zoom).toBeCloseTo(560 / 620, 12);
    expect(fit.visibleWorldWidth).toBeGreaterThan(GAME_WORLD.width);
    expect(fit.visibleWorldHeight).toBeCloseTo(GAME_WORLD.height, 12);
  });

  it('reveals side space on a wide stage instead of clipping at the old canvas edge', () => {
    const fit = fitStageViewport({ width: 1050, height: 780 }, GAME_WORLD);

    expect(fit.zoom).toBeCloseTo(780 / 620, 12);
    expect(fit.visibleWorldWidth).toBeGreaterThan(800);
    expect((fit.visibleWorldWidth - GAME_WORLD.width) / 2).toBeGreaterThan(200);
    expect(fit.visibleWorldHeight).toBeCloseTo(GAME_WORLD.height, 12);
  });

  it('rejects invalid dimensions instead of producing an unusable camera', () => {
    expect(() => fitStageViewport({ width: 0, height: 620 }, GAME_WORLD)).toThrow(RangeError);
    expect(() => fitStageViewport({ width: 390, height: 620 }, { width: 390, height: NaN })).toThrow(RangeError);
  });
});
