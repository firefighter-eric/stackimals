import { describe, expect, it } from 'vitest';

import {
  isConvexPolygon,
  isSimplePolygon,
  polygonBounds,
  polygonCentroid,
  polygonSignedArea,
} from '../game/data/collisionGeometry';
import { ANIMALS } from '../game/data/animals';

const LEGACY_DISPLAY_AREAS = {
  bear: 98 * 82,
  bird: 58 * 55,
  cat: 72 * 74,
  fox: 92 * 68,
  hedgehog: 82 * 58,
  rabbit: 68 * 90,
  raccoon: 86 * 70,
  turtle: 94 * 52,
} as const;

describe('alpha-derived animal collision geometry', () => {
  it('preserves every source WebP aspect ratio without changing gameplay area', () => {
    for (const animal of ANIMALS) {
      expect(animal.display.width / animal.display.height).toBeCloseTo(
        animal.sourceSize.width / animal.sourceSize.height,
        12,
      );
      expect(animal.display.width * animal.display.height).toBeCloseTo(
        LEGACY_DISPLAY_AREAS[animal.id],
        8,
      );
    }
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
