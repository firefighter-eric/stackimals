import type { AABB, Actor, MatchOutcome, MatchPhase } from './types';
import { otherActor } from './types';

export interface FallenBody {
  readonly id: string;
  readonly owner: Actor;
  /** True when this is the animal released during the current turn. */
  readonly isCurrentDrop?: boolean;
}

export interface FallOutcomeInput {
  readonly phase: MatchPhase;
  /** The actor whose release initiated the current settle window. */
  readonly actingActor?: Actor;
  readonly fallenBodies: readonly FallenBody[];
}

/**
 * Attribute a loss deterministically. During a drop/settle window, the actor
 * who made the move owns every consequence, including knocking an older body
 * from either side off the platform.
 */
export function resolveFallOutcome(input: FallOutcomeInput): MatchOutcome | null {
  if (input.fallenBodies.length === 0 || input.phase === 'game-over') {
    return null;
  }

  const currentDrop = input.fallenBodies.find((body) => body.isCurrentDrop === true);
  const isActiveResolution = input.phase === 'dropping' || input.phase === 'settling';
  const loser = isActiveResolution && input.actingActor !== undefined
    ? input.actingActor
    : currentDrop?.owner ?? input.fallenBodies[0]?.owner;

  if (loser === undefined) {
    return null;
  }

  const reason: MatchOutcome['reason'] = currentDrop !== undefined
    ? 'active-drop-fell'
    : isActiveResolution && input.actingActor !== undefined
      ? 'chain-reaction'
      : 'unattributed-fall';

  return {
    winner: otherActor(loser),
    loser,
    reason,
    fallenBodyIds: input.fallenBodies.map((body) => body.id),
  };
}

export function isOutOfPlay(body: AABB, fallBoundaryY: number, horizontalBounds?: Pick<AABB, 'minX' | 'maxX'>): boolean {
  if (body.minY > fallBoundaryY) {
    return true;
  }

  return horizontalBounds !== undefined
    && (body.maxX < horizontalBounds.minX || body.minX > horizontalBounds.maxX);
}

export function canActorAim(phase: MatchPhase, actor: Actor, activeActor: Actor): boolean {
  return phase === 'aiming' && actor === activeActor;
}
