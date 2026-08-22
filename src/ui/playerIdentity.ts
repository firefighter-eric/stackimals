import { ANIMAL_IDS, type AnimalId } from '../game/core';

export const PLAYER_ANIMAL_STORAGE_KEY = 'stackimals-player-animal';
export const DEFAULT_PLAYER_ANIMAL: AnimalId = 'fox';

const OPPONENT_PREFERENCE: readonly AnimalId[] = [
  'bear',
  'elephant',
  'raccoon',
  'penguin',
  'crocodile',
  'giraffe',
  'turtle',
  'cat',
  'rabbit',
  'hedgehog',
  'tiger',
  'mouse',
  'frog',
  'bird',
  'fox',
];

export function isAnimalId(value: string | null): value is AnimalId {
  return value !== null && ANIMAL_IDS.some((id) => id === value);
}

export function opponentAnimalFor(playerAnimal: AnimalId): AnimalId {
  return OPPONENT_PREFERENCE.find((id) => id !== playerAnimal) ?? ANIMAL_IDS[0];
}

export function readStoredPlayerAnimal(): AnimalId {
  try {
    const stored = window.localStorage.getItem(PLAYER_ANIMAL_STORAGE_KEY);
    return isAnimalId(stored) ? stored : DEFAULT_PLAYER_ANIMAL;
  } catch {
    return DEFAULT_PLAYER_ANIMAL;
  }
}

export function storePlayerAnimal(animal: AnimalId): void {
  try {
    window.localStorage.setItem(PLAYER_ANIMAL_STORAGE_KEY, animal);
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}
