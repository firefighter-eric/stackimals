/** Shared Matter contact values for the side-view wooden platform. */
export const WOOD_PLATFORM_PHYSICS = {
  // Matter combines kinetic friction with Math.min. Ordinary animals provide
  // the lower impact value; this platform ceiling preserves the tiger's tested
  // compound-body exception without raising their collision impulse.
  friction: 0.9,
  frictionStatic: 1.25,
  restitution: 0.006,
} as const;

/** Default-sized Matter tolerance prevents micro-corrections on detailed outlines. */
export const WOOD_CONTACT_SLOP = 0.05;

/** A third of a second of near-zero motion is enough to latch a wooden piece at rest. */
export const WOOD_SLEEP_THRESHOLD = 20;
