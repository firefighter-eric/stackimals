import { describe, expect, it } from 'vitest';

import { getAnimalDefinition } from '../game/data';
import { WOOD_PLATFORM_PHYSICS } from '../game/data/woodPhysics';
import {
  addToMatterWorld,
  createAnimalMatterBody,
  createMatterEngine,
  createRectangle,
  stepMatter,
  type TestMatterBody,
} from './helpers/phaserMatter';

const MAX_SETTLING_FRAMES = 600;

interface DropStep {
  readonly animalId: Parameters<typeof getAnimalDefinition>[0];
  readonly x: number;
  readonly angle: number;
}

interface SettlingStepResult {
  readonly sleepingFrame: number | null;
  readonly awakenedLowerBodies: number;
  readonly lowMotionAwakeFrames: number;
}

function settleTowerStep(bodies: readonly TestMatterBody[], engine: ReturnType<typeof createMatterEngine>): SettlingStepResult {
  const lowerBodies = bodies.slice(0, -1);
  let sleepingFrame: number | null = null;
  let awakenedLowerBodies = 0;
  let lowMotionAwakeFrames = 0;

  for (let frame = 0; frame < MAX_SETTLING_FRAMES; frame += 1) {
    stepMatter(engine, 1);
    awakenedLowerBodies = Math.max(
      awakenedLowerBodies,
      lowerBodies.filter((body) => !body.isSleeping).length,
    );

    const hasLowMotionAwakeBody = bodies.some((body) => (
      !body.isSleeping
      && Math.hypot(body.velocity.x, body.velocity.y) <= 0.12
      && Math.abs(body.angularVelocity) <= 0.018
    ));
    if (hasLowMotionAwakeBody) {
      lowMotionAwakeFrames += 1;
    }

    if (bodies.every((body) => body.isSleeping)) {
      sleepingFrame = frame;
      break;
    }
  }

  return { sleepingFrame, awakenedLowerBodies, lowMotionAwakeFrames };
}

function simulateTower(sequence: readonly DropStep[]): readonly SettlingStepResult[] {
  const engine = createMatterEngine();
  const platform = createRectangle(0, 548, 294, 24, {
    isStatic: true,
    ...WOOD_PLATFORM_PHYSICS,
  });
  const bodies: TestMatterBody[] = [];
  addToMatterWorld(engine, platform);

  return sequence.map((step) => {
    const body = createAnimalMatterBody(
      getAnimalDefinition(step.animalId),
      step.x,
      96,
      step.angle,
    );
    bodies.push(body);
    addToMatterWorld(engine, body);
    return settleTowerStep(bodies, engine);
  });
}

describe('tower impact settling regression', () => {
  it('lets a representative wooden tower absorb later impacts and return to sleep', () => {
    const results = simulateTower([
      { animalId: 'crocodile', x: 0, angle: 0 },
      { animalId: 'elephant', x: 0, angle: 0 },
      { animalId: 'bear', x: 0, angle: 0 },
      { animalId: 'turtle', x: 0, angle: 0 },
    ]);

    for (const [index, result] of results.entries()) {
      expect.soft(result.sleepingFrame, `drop ${index + 1}: sleeping frame`).not.toBeNull();
      expect.soft(result.sleepingFrame ?? Infinity, `drop ${index + 1}: sleeping frame`).toBeLessThanOrEqual(
        180,
      );
      expect.soft(
        result.lowMotionAwakeFrames,
        `drop ${index + 1}: low-motion awake frames`,
      ).toBeLessThanOrEqual(45);
    }

    // Later drops must still wake supporting bodies. The tuning removes tiny
    // solver chatter; it must not pin the already placed tower in space.
    for (const [index, result] of results.slice(1).entries()) {
      expect.soft(result.awakenedLowerBodies, `drop ${index + 2}: awakened supports`).toBeGreaterThan(0);
    }
  });
});
