import { describe, expect, it } from 'vitest';
import {
  MAX_GAME_RENDER_SCALE,
  renderScaleForDevicePixelRatio,
} from '../game/core/renderResolution';

describe('renderScaleForDevicePixelRatio', () => {
  it('keeps ordinary displays at one backing pixel per CSS pixel', () => {
    expect(renderScaleForDevicePixelRatio(1)).toBe(1);
    expect(renderScaleForDevicePixelRatio(0)).toBe(1);
    expect(renderScaleForDevicePixelRatio(Number.NaN)).toBe(1);
  });

  it('uses high-density backing pixels and caps the WebGL cost', () => {
    expect(renderScaleForDevicePixelRatio(1.5)).toBe(1.5);
    expect(renderScaleForDevicePixelRatio(2)).toBe(2);
    expect(renderScaleForDevicePixelRatio(3)).toBe(MAX_GAME_RENDER_SCALE);
  });
});
