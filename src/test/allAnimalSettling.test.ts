import { describe, expect, it } from 'vitest';

import { ANIMALS, type AnimalDefinition } from '../game/data/animals';
import { WOOD_PLATFORM_PHYSICS } from '../game/data/woodPhysics';
import {
  addToMatterWorld,
  compoundCollisionDepths,
  createAnimalMatterBody,
  createMatterEngine,
  createRectangle,
  stepMatter,
} from './helpers/phaserMatter';

const MAX_SIMULATION_FRAMES = 600;
const QUIET_FRAMES = 30;

interface SettlingResult {
  readonly madeContact: boolean;
  readonly quietFrame: number | null;
  readonly sleepFrame: number | null;
  readonly contactTransitions: number;
  readonly stayedOnPlatform: boolean;
}

function simulateDrop(animal: AnimalDefinition, angle: number): SettlingResult {
  const engine = createMatterEngine();
  const platform = createRectangle(0, 548, 294, 24, {
    isStatic: true,
    ...WOOD_PLATFORM_PHYSICS,
  });
  const body = createAnimalMatterBody(animal, 0, 96, angle);
  addToMatterWorld(engine, [platform, body]);

  let madeContact = false;
  let hadContact = false;
  let contactTransitions = 0;
  let quietRun = 0;
  let quietFrame: number | null = null;
  let sleepFrame: number | null = null;

  for (let frame = 0; frame < MAX_SIMULATION_FRAMES; frame += 1) {
    stepMatter(engine, 1);
    const hasContact = compoundCollisionDepths(body, platform).length > 0;
    if (hasContact !== hadContact) {
      contactTransitions += 1;
      hadContact = hasContact;
    }
    madeContact ||= hasContact;

    const quiet = body.isSleeping
      || (Math.hypot(body.velocity.x, body.velocity.y) <= 0.08
        && Math.abs(body.angularVelocity) <= 0.012);
    quietRun = madeContact && quiet ? quietRun + 1 : 0;
    if (quietRun >= QUIET_FRAMES && quietFrame === null) {
      quietFrame = frame;
    }
    if (body.isSleeping && sleepFrame === null) {
      sleepFrame = frame;
    }
  }

  return {
    madeContact,
    quietFrame,
    sleepFrame,
    contactTransitions,
    stayedOnPlatform: body.bounds.max.x >= -147
      && body.bounds.min.x <= 147
      && body.bounds.min.y <= 560,
  };
}

describe('all-animal settling regression', () => {
  it('settles every animal from its intended flat-platform postures without persistent chatter', () => {
    for (const animal of ANIMALS) {
      const intendedAngles = [...new Set([0, ...animal.gameplay.preferredAngles])];
      for (const angle of intendedAngles) {
        const result = simulateDrop(animal, angle);
        const label = `${animal.id} ${angle}deg`;

        expect.soft(result.madeContact, `${label}: reached platform`).toBe(true);
        expect.soft(result.stayedOnPlatform, `${label}: stayed on platform`).toBe(true);
        expect.soft(result.quietFrame, `${label}: quiet frame`).not.toBeNull();
        expect.soft(result.quietFrame ?? Infinity, `${label}: quiet frame`).toBeLessThanOrEqual(420);
        expect.soft(result.sleepFrame, `${label}: sleeping frame`).not.toBeNull();
        expect.soft(result.sleepFrame ?? Infinity, `${label}: sleeping frame`).toBeLessThanOrEqual(480);
        expect.soft(result.contactTransitions, `${label}: contact transitions`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('eventually sleeps every legal-angle drop that remains in play', () => {
    for (const animal of ANIMALS) {
      for (const angle of animal.allowedAngles) {
        const result = simulateDrop(animal, angle);
        if (!result.stayedOnPlatform) {
          continue;
        }

        const label = `${animal.id} ${angle}deg`;
        expect.soft(result.madeContact, `${label}: reached platform`).toBe(true);
        expect.soft(result.sleepFrame, `${label}: sleeping frame`).not.toBeNull();
        expect.soft(result.sleepFrame ?? Infinity, `${label}: sleeping frame`).toBeLessThan(
          MAX_SIMULATION_FRAMES,
        );
      }
    }
  });
});
