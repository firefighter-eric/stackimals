import { describe, expect, it } from 'vitest';

import {
  isConvexPolygon,
  isSimplePolygon,
  polygonBounds,
  polygonCentroid,
  polygonSignedArea,
} from '../game/data/collisionGeometry';
import { ANIMALS } from '../game/data/animals';

const EXPECTED_DISPLAY_WIDTHS = {
  bear: 148,
  bird: 56,
  cat: 88,
  fox: 122,
  hedgehog: 76,
  rabbit: 76,
  raccoon: 108,
  turtle: 104,
} as const;

describe('alpha-derived animal collision geometry', () => {
  it('uses one uniform render scale while preserving every source WebP aspect ratio', () => {
    for (const animal of ANIMALS) {
      expect(animal.display.width).toBe(EXPECTED_DISPLAY_WIDTHS[animal.id]);
      expect(animal.display.width).toBeCloseTo(
        animal.sourceSize.width * animal.displayScale,
        12,
      );
      expect(animal.display.height).toBeCloseTo(
        animal.sourceSize.height * animal.displayScale,
        12,
      );
      expect(animal.display.width / animal.display.height).toBeCloseTo(
        animal.sourceSize.width / animal.sourceSize.height,
        12,
      );
    }
  });

  it('makes large and small animals visibly different without exceeding the playfield', () => {
    const widths = ANIMALS.map((animal) => animal.display.width);
    const areas = ANIMALS.map((animal) => animal.display.width * animal.display.height);

    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(2.4);
    expect(Math.max(...areas) / Math.min(...areas)).toBeGreaterThan(5);
    expect(Math.max(...ANIMALS.map((animal) => (
      Math.max(animal.display.width, animal.display.height)
    )))).toBeLessThan(322);
  });

  it('provides simple clockwise concave outlines in displayed-texture coordinates', () => {
    for (const animal of ANIMALS) {
      const outline = animal.collision.outline;
      const bounds = polygonBounds(outline);

      expect(outline.length).toBeGreaterThanOrEqual(20);
      expect(outline.length).toBeLessThanOrEqual(45);
      expect(isSimplePolygon(outline)).toBe(true);
      expect(isConvexPolygon(outline)).toBe(false);
      // Positive signed area is clockwise in the texture's y-down coordinates.
      expect(polygonSignedArea(outline)).toBeGreaterThan(0);
      expect(bounds.minX).toBeGreaterThanOrEqual(0);
      expect(bounds.minY).toBeGreaterThanOrEqual(0);
      expect(bounds.maxX).toBeLessThanOrEqual(animal.display.width);
      expect(bounds.maxY).toBeLessThanOrEqual(animal.display.height);
    }
  });

  it('keeps alpha bounds and texture origin synchronized with display scaling', () => {
    for (const animal of ANIMALS) {
      const scaleX = animal.display.width / animal.sourceSize.width;
      const scaleY = animal.display.height / animal.sourceSize.height;
      const sourceBounds = animal.collision.sourceAlphaBounds;
      const bounds = animal.collision.alphaBounds;
      const centroid = polygonCentroid(animal.collision.outline);

      expect(bounds.minX).toBeCloseTo(sourceBounds.minX * scaleX, 10);
      expect(bounds.minY).toBeCloseTo(sourceBounds.minY * scaleY, 10);
      expect(bounds.maxX).toBeCloseTo(sourceBounds.maxX * scaleX, 10);
      expect(bounds.maxY).toBeCloseTo(sourceBounds.maxY * scaleY, 10);
      expect(animal.collision.textureOrigin.x).toBeCloseTo(centroid.x / animal.display.width, 12);
      expect(animal.collision.textureOrigin.y).toBeCloseTo(centroid.y / animal.display.height, 12);
      expect(animal.collision.textureOrigin.x).toBeGreaterThan(0);
      expect(animal.collision.textureOrigin.x).toBeLessThan(1);
      expect(animal.collision.textureOrigin.y).toBeGreaterThan(0);
      expect(animal.collision.textureOrigin.y).toBeLessThan(1);
    }
  });

  it('records high alpha-mask coverage for every simplified outline', () => {
    for (const animal of ANIMALS) {
      expect(animal.collision.fit.alphaThreshold).toBe(48);
      expect(animal.collision.fit.opaqueCoverage).toBeGreaterThanOrEqual(0.97);
      expect(animal.collision.fit.outlinePrecision).toBeGreaterThanOrEqual(0.98);
    }
  });
});
