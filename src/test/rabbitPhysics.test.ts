import { describe, expect, it } from 'vitest';

import { getAnimalDefinition } from '../game/data';
import { WOOD_PLATFORM_PHYSICS } from '../game/data/woodPhysics';
import {
  addToMatterWorld,
  childParts,
  compoundCollisionDepths,
  createAnimalMatterBody,
  createMatterEngine,
  createRectangle,
  stepMatter,
} from './helpers/phaserMatter';

const MAX_SIMULATION_FRAMES = 480;
const STABLE_FRAMES = 51;

interface DropResult {
  readonly madeContact: boolean;
  readonly stableFrame: number | null;
  readonly contactTransitions: number;
  readonly partCount: number;
}

function simulateRabbitDrop(angle: number): DropResult {
  const rabbit = getAnimalDefinition('rabbit');
  const engine = createMatterEngine();
  const platform = createRectangle(0, 548, 294, 24, {
    isStatic: true,
    ...WOOD_PLATFORM_PHYSICS,
  });
  const body = createAnimalMatterBody(rabbit, 0, 96, angle);
  addToMatterWorld(engine, [platform, body]);

  let madeContact = false;
  let hadContact = false;
  let contactTransitions = 0;
  let stableRun = 0;
  let stableFrame: number | null = null;

  for (let frame = 0; frame < MAX_SIMULATION_FRAMES; frame += 1) {
    stepMatter(engine, 1);
    const hasContact = compoundCollisionDepths(body, platform).length > 0;
    if (hasContact !== hadContact) {
      contactTransitions += 1;
      hadContact = hasContact;
    }
    madeContact ||= hasContact;

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    const atRest = body.isSleeping
      || (speed <= 0.12 && Math.abs(body.angularVelocity) <= 0.018);
    stableRun = madeContact && atRest ? stableRun + 1 : 0;
    if (stableRun >= STABLE_FRAMES && stableFrame === null) {
      stableFrame = frame;
    }
  }

  return {
    madeContact,
    stableFrame,
    contactTransitions,
    partCount: childParts(body).length,
  };
}

describe('rabbit physics', () => {
  it('settles quickly after a straight drop onto the flat platform', () => {
    const result = simulateRabbitDrop(0);

    expect(result.madeContact).toBe(true);
    expect(result.partCount).toBe(2);
    expect(result.stableFrame).not.toBeNull();
    expect(result.stableFrame!).toBeLessThanOrEqual(300);
    expect(result.contactTransitions).toBeLessThanOrEqual(3);
  });

  it('does not chatter at legal or near-upright drop angles', () => {
    const rabbit = getAnimalDefinition('rabbit');
    const angles = [...new Set([...rabbit.allowedAngles, -5, -2, 2, 5])];

    for (const angle of angles) {
      const result = simulateRabbitDrop(angle);
      expect(result.madeContact, `${angle}deg: reached platform`).toBe(true);
      expect(result.stableFrame, `${angle}deg: stable frame`).not.toBeNull();
      expect(result.stableFrame!, `${angle}deg: stable frame`).toBeLessThanOrEqual(300);
      expect(result.contactTransitions, `${angle}deg: contact transitions`).toBeLessThanOrEqual(3);
    }
  });
});
