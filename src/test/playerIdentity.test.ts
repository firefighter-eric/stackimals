import { describe, expect, it } from 'vitest';

import { ANIMAL_IDS } from '../game/core';
import {
  DEFAULT_PLAYER_ANIMAL,
  isAnimalId,
  opponentAnimalFor,
} from '../ui/playerIdentity';

describe('player animal identity', () => {
  it('recognizes only catalog animal ids', () => {
    expect(isAnimalId(DEFAULT_PLAYER_ANIMAL)).toBe(true);
    expect(isAnimalId('dragon')).toBe(false);
    expect(isAnimalId(null)).toBe(false);
  });

  it('always gives Milo a different catalog animal', () => {
    for (const playerAnimal of ANIMAL_IDS) {
      const opponentAnimal = opponentAnimalFor(playerAnimal);
      expect(ANIMAL_IDS).toContain(opponentAnimal);
      expect(opponentAnimal).not.toBe(playerAnimal);
    }
  });
});
