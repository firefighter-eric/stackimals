/** The renderer-independent phases a versus-AI match can be in. */
export const MATCH_PHASES = [
  'ready',
  'aiming',
  'thinking',
  'dropping',
  'settling',
  'game-over',
] as const;

export type MatchPhase = (typeof MATCH_PHASES)[number];

export const ACTORS = ['player', 'ai'] as const;

export type Actor = (typeof ACTORS)[number];

export const ANIMAL_IDS = [
  'bear',
  'bird',
  'cat',
  'fox',
  'hedgehog',
  'rabbit',
  'raccoon',
  'turtle',
] as const;

export type AnimalId = (typeof ANIMAL_IDS)[number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface HorizontalSpan {
  readonly minX: number;
  readonly maxX: number;
}

export interface AABB extends HorizontalSpan {
  readonly minY: number;
  readonly maxY: number;
}

/**
 * A serializable snapshot of a physics body. Scenes should convert Matter
 * bodies into this shape before calling rules or AI code.
 */
export interface StackBodySnapshot {
  readonly id: string;
  readonly animalId?: AnimalId;
  readonly owner?: Actor;
  readonly aabb: AABB;
  readonly position: Point;
  readonly angle: number;
  readonly velocity?: Point;
  readonly angularVelocity?: number;
  readonly isSleeping?: boolean;
}

export interface MatchOutcome {
  readonly winner: Actor;
  readonly loser: Actor;
  readonly reason: 'active-drop-fell' | 'chain-reaction' | 'unattributed-fall';
  readonly fallenBodyIds: readonly string[];
}

export function otherActor(actor: Actor): Actor {
  return actor === 'player' ? 'ai' : 'player';
}
