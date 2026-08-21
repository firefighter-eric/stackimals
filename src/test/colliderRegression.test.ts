import { describe, expect, it } from 'vitest';

import { ANIMALS } from '../game/data/animals';
import {
  collectColliderAlphaMetrics,
  isConvexPolygon,
  polygonSignedArea,
} from './helpers/colliderMetrics';
import {
  addToMatterWorld,
  childParts,
  compoundCollisionDepths,
  createAnimalMatterBody,
  createMatterEngine,
  createRectangle,
  stepMatter,
} from './helpers/phaserMatter';

describe('animal collider regression', () => {
  it('builds finite, positive, convex Matter parts for every animal', () => {
    for (const animal of ANIMALS) {
      const body = createAnimalMatterBody(animal);
      const parts = childParts(body);

      expect(parts.length, `${animal.id}: decomposed Matter child-part count`).toBeGreaterThan(1);
      expect(parts.length, `${animal.id}: bounded Matter child-part count`).toBeLessThan(
        animal.collision.outline.length,
      );
      expect(Number.isFinite(body.position.x), `${animal.id}: finite body x`).toBe(true);
      expect(Number.isFinite(body.position.y), `${animal.id}: finite body y`).toBe(true);

      for (const [index, part] of parts.entries()) {
        expect(part.vertices.length, `${animal.id} part ${index}: vertex count`).toBeGreaterThanOrEqual(3);
        expect(
          part.vertices.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y)),
          `${animal.id} part ${index}: finite vertices`,
        ).toBe(true);
        expect(
          Math.abs(polygonSignedArea(part.vertices)),
          `${animal.id} part ${index}: positive area`,
        ).toBeGreaterThan(1);
        expect(isConvexPolygon(part.vertices), `${animal.id} part ${index}: convex`).toBe(true);
        expect(part.bounds.max.x, `${animal.id} part ${index}: valid x bounds`).toBeGreaterThan(
          part.bounds.min.x,
        );
        expect(part.bounds.max.y, `${animal.id} part ${index}: valid y bounds`).toBeGreaterThan(
          part.bounds.min.y,
        );
      }
    }
  });

  it('keeps the runtime collider close to the visible alpha silhouette', () => {
    for (const animal of ANIMALS) {
      const metrics = collectColliderAlphaMetrics(animal);
      const widthRatio = metrics.colliderBounds.width / metrics.opaqueBounds.width;
      const heightRatio = metrics.colliderBounds.height / metrics.opaqueBounds.height;
      const centerDeltaX = Math.abs(
        (metrics.colliderBounds.minX + metrics.colliderBounds.maxX
          - metrics.opaqueBounds.minX - metrics.opaqueBounds.maxX) / 2,
      );
      const centerDeltaY = Math.abs(
        (metrics.colliderBounds.minY + metrics.colliderBounds.maxY
          - metrics.opaqueBounds.minY - metrics.opaqueBounds.maxY) / 2,
      );
      const horizontalOverflowTolerance = Math.max(4, animal.display.width * 0.08);
      const verticalOverflowTolerance = Math.max(4, animal.display.height * 0.08);
      const originX = animal.collision.textureOrigin.x * animal.display.width;
      const originY = animal.collision.textureOrigin.y * animal.display.height;

      expect(metrics.webpSize, `${animal.id}: checked-in WebP dimensions`).toEqual(animal.sourceSize);
      expect(
        metrics.sourceTrimAspectError,
        `${animal.id}: source/runtime crop aspect drift`,
      ).toBeLessThan(0.01);
      expect(
        metrics.colliderBounds.minX,
        `${animal.id}: collider left display overflow`,
      ).toBeGreaterThanOrEqual(-originX - horizontalOverflowTolerance);
      expect(
        metrics.colliderBounds.maxX,
        `${animal.id}: collider right display overflow`,
      ).toBeLessThanOrEqual(animal.display.width - originX + horizontalOverflowTolerance);
      expect(
        metrics.colliderBounds.minY,
        `${animal.id}: collider top display overflow`,
      ).toBeGreaterThanOrEqual(-originY - verticalOverflowTolerance);
      expect(
        metrics.colliderBounds.maxY,
        `${animal.id}: collider bottom display overflow`,
      ).toBeLessThanOrEqual(animal.display.height - originY + verticalOverflowTolerance);
      expect(widthRatio, `${animal.id}: collider/alpha width ratio`).toBeGreaterThan(0.97);
      expect(widthRatio, `${animal.id}: collider/alpha width ratio`).toBeLessThan(1.03);
      expect(heightRatio, `${animal.id}: collider/alpha height ratio`).toBeGreaterThan(0.97);
      expect(heightRatio, `${animal.id}: collider/alpha height ratio`).toBeLessThan(1.03);
      expect(centerDeltaX, `${animal.id}: collider/alpha horizontal center drift`).toBeLessThan(
        Math.max(0.5, animal.display.width * 0.01),
      );
      expect(centerDeltaY, `${animal.id}: collider/alpha vertical center drift`).toBeLessThan(
        Math.max(0.5, animal.display.height * 0.01),
      );
      expect(
        metrics.opaqueCoveredByCollider,
        `${animal.id}: visible alpha covered by collider`,
      ).toBeGreaterThan(0.95);
      expect(
        metrics.colliderCoveredByOpaque,
        `${animal.id}: collider backed by visible alpha`,
      ).toBeGreaterThan(0.97);
    }
  });

  it('resolves a fixed-step animal stack without deep interpenetration', () => {
    const turtle = ANIMALS.find((animal) => animal.id === 'turtle')!;
    const bear = ANIMALS.find((animal) => animal.id === 'bear')!;
    const engine = createMatterEngine();
    const platform = createRectangle(0, 120, 294, 24, {
      isStatic: true,
      friction: 0.9,
      frictionStatic: 1,
      restitution: 0.01,
    });
    const lower = createAnimalMatterBody(turtle, 0, 40);
    const upper = createAnimalMatterBody(bear, 0, -80);
    addToMatterWorld(engine, [platform, lower, upper]);

    let animalContactFrames = 0;
    let maximumObservedDepth = 0;
    for (let frame = 0; frame < 720; frame += 1) {
      stepMatter(engine, 1);
      const depths = compoundCollisionDepths(lower, upper);
      if (depths.length > 0) {
        animalContactFrames += 1;
        maximumObservedDepth = Math.max(maximumObservedDepth, ...depths);
      }
    }

    const finalDepths = compoundCollisionDepths(lower, upper);
    expect(animalContactFrames, 'the animals should make sustained contact').toBeGreaterThan(30);
    expect(upper.position.y, 'the upper animal must not tunnel below the lower animal').toBeLessThan(lower.position.y);
    expect(maximumObservedDepth, 'transient animal overlap depth').toBeLessThan(4);
    expect(Math.max(0, ...finalDepths), 'settled animal overlap depth').toBeLessThan(1.2);
  });
});
