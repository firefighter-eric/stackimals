import { describe, expect, it } from 'vitest';

import { getAnimalDefinition } from '../game/data';
import { WOOD_PLATFORM_PHYSICS, WOOD_RUNNER } from '../game/data/woodPhysics';
import {
  addToMatterWorld,
  compoundCollisionDepths,
  createAnimalMatterBody,
  createMatterEngine,
  createRectangle,
  stepMatter,
} from './helpers/phaserMatter';

describe('oblique animal impacts', () => {
  // These continuous player angles exposed repeated upward impulses between
  // compound parts even with almost zero restitution. Flat-platform tests did
  // not exercise the changing contact normals of an animal-on-animal impact.
  it.each([
    { base: 'tiger', top: 'giraffe', angle: 170 },
    { base: 'bear', top: 'mouse', angle: 0 },
    { base: 'hedgehog', top: 'giraffe', angle: -13 },
    { base: 'frog', top: 'mouse', angle: 90 },
    { base: 'mouse', top: 'crocodile', angle: -45 },
    { base: 'bear', top: 'giraffe', angle: -45 },
  ] as const)('settles $top at $angle degrees on $base without repeated rebounds', ({ base, top, angle }) => {
    const engine = createMatterEngine();
    const platform = createRectangle(0, 548, 294, 24, {
      isStatic: true,
      ...WOOD_PLATFORM_PHYSICS,
    });
    const definition = getAnimalDefinition(base);
    const lower = createAnimalMatterBody(definition, 0, 96, definition.gameplay.preferredAngles[0]);
    addToMatterWorld(engine, [platform, lower]);
    stepMatter(engine, 480);
    expect(lower.isSleeping, 'the supporting animal starts at rest').toBe(true);

    const upper = createAnimalMatterBody(getAnimalDefinition(top), 9, 96, angle);
    const bodies = [lower, upper];
    addToMatterWorld(engine, upper);
    const stepMs = 1000 / WOOD_RUNNER.fps;
    let contactTimeMs: number | null = null;
    let sleepTimeMs: number | null = null;
    let upwardPeak = 0;
    let reversals = 0;
    let lastDirection = 0;
    let supportWoke = false;

    // Keep observing after the first sleep: a later contact must not start
    // another cycle of self-sustaining chatter.
    for (let frame = 0; frame < 10 * WOOD_RUNNER.fps; frame += 1) {
      stepMatter(engine, 1, stepMs);
      const elapsedMs = (frame + 1) * stepMs;
      supportWoke ||= !lower.isSleeping;
      if (contactTimeMs === null && compoundCollisionDepths(lower, upper).length > 0) {
        contactTimeMs = elapsedMs;
      }
      if (bodies.every((body) => body.isSleeping) && sleepTimeMs === null) {
        sleepTimeMs = elapsedMs;
      }
      if (contactTimeMs !== null) {
        upwardPeak = Math.max(upwardPeak, -lower.velocity.y, -upper.velocity.y);
        // Ignore the initial impact and sub-pixel motion; measure the visible
        // back-and-forth bouncing that persisted after it in the regression.
        if (elapsedMs > contactTimeMs + 1000 / 3 && !upper.isSleeping) {
          const direction = Math.abs(upper.velocity.y) > 0.03 ? Math.sign(upper.velocity.y) : 0;
          if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
            reversals += 1;
          }
          if (direction !== 0) lastDirection = direction;
        }
      }
    }

    expect(contactTimeMs, 'animals actually collide').not.toBeNull();
    expect(supportWoke, 'supports remain dynamic when hit').toBe(true);
    expect.soft(upwardPeak, 'bounded upward impulse in Matter base-step units').toBeLessThan(2);
    expect.soft(reversals, 'visible bounces after the initial impact').toBeLessThanOrEqual(8);
    expect.soft(sleepTimeMs ?? Infinity, 'both animals settle within four seconds').toBeLessThan(4000);
    for (const body of bodies) {
      expect(body.isSleeping, 'remains at rest after ten seconds').toBe(true);
      expect(body.bounds.min.y, 'has not fallen below the platform').toBeLessThan(548);
      expect(body.bounds.min.x, 'remains over the platform').toBeLessThan(147);
      expect(body.bounds.max.x, 'remains over the platform').toBeGreaterThan(-147);
    }
  });
});
