import type { Point, StackBodySnapshot } from './types';

export interface StabilityConfig {
  /** Matter's velocity is expressed in pixels per simulation step. */
  readonly maxLinearSpeed: number;
  /** Radians per simulation step. */
  readonly maxAngularSpeed: number;
  /** All bodies must remain quiet for this long before the turn advances. */
  readonly requiredStableMs: number;
  /** Hard stop so a tiny physics jitter cannot deadlock a match. */
  readonly maxWaitMs: number;
}

export const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  maxLinearSpeed: 0.12,
  maxAngularSpeed: 0.018,
  requiredStableMs: 850,
  maxWaitMs: 8_000,
};

export type StabilityState = 'moving' | 'stable' | 'timed-out';

export interface StabilityResult {
  readonly state: StabilityState;
  readonly stableForMs: number;
  readonly elapsedMs: number;
  readonly movingBodyIds: readonly string[];
}

type MotionBody = Pick<StackBodySnapshot, 'id' | 'velocity' | 'angularVelocity' | 'isSleeping'>;

function speed(velocity: Point | undefined): number {
  if (velocity === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(velocity.x, velocity.y);
}

export function isBodyAtRest(
  body: MotionBody,
  config: Pick<StabilityConfig, 'maxLinearSpeed' | 'maxAngularSpeed'> = DEFAULT_STABILITY_CONFIG,
): boolean {
  if (body.isSleeping === true) {
    return true;
  }

  if (body.velocity === undefined || body.angularVelocity === undefined) {
    // Missing motion data is not evidence that a body is stable.
    return false;
  }

  return speed(body.velocity) <= config.maxLinearSpeed
    && Math.abs(body.angularVelocity) <= config.maxAngularSpeed;
}

/**
 * Stateful continuous-rest detector. Call sample() with a monotonic clock and
 * all live stack bodies; reset it when a new animal is released.
 */
export class StabilityDetector {
  private readonly config: StabilityConfig;
  private startedAt: number | undefined;
  private stableSince: number | undefined;
  private lastSampleAt: number | undefined;

  constructor(config: Partial<StabilityConfig> = {}) {
    this.config = { ...DEFAULT_STABILITY_CONFIG, ...config };
    if (
      this.config.maxLinearSpeed < 0
      || this.config.maxAngularSpeed < 0
      || this.config.requiredStableMs < 0
      || this.config.maxWaitMs <= 0
    ) {
      throw new RangeError('Stability thresholds must be non-negative and maxWaitMs must be positive.');
    }
  }

  sample(nowMs: number, bodies: readonly MotionBody[]): StabilityResult {
    if (!Number.isFinite(nowMs)) {
      throw new RangeError('Stability sample time must be finite.');
    }
    if (this.lastSampleAt !== undefined && nowMs < this.lastSampleAt) {
      throw new RangeError('Stability sample time must be monotonic.');
    }

    this.startedAt ??= nowMs;
    this.lastSampleAt = nowMs;

    const movingBodyIds = bodies.filter((body) => !isBodyAtRest(body, this.config)).map((body) => body.id);
    if (movingBodyIds.length > 0) {
      this.stableSince = undefined;
    } else {
      this.stableSince ??= nowMs;
    }

    const elapsedMs = nowMs - this.startedAt;
    const stableForMs = this.stableSince === undefined ? 0 : nowMs - this.stableSince;

    if (stableForMs >= this.config.requiredStableMs) {
      return { state: 'stable', stableForMs, elapsedMs, movingBodyIds };
    }

    if (elapsedMs >= this.config.maxWaitMs) {
      return { state: 'timed-out', stableForMs, elapsedMs, movingBodyIds };
    }

    return { state: 'moving', stableForMs, elapsedMs, movingBodyIds };
  }

  reset(): void {
    this.startedAt = undefined;
    this.stableSince = undefined;
    this.lastSampleAt = undefined;
  }
}
