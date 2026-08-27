/** Shared Matter contact values for the side-view wooden platform. */
export const WOOD_PLATFORM_PHYSICS = {
  // Matter combines kinetic friction with Math.min. Ordinary animals provide
  // the lower impact value; this platform ceiling preserves the tiger's tested
  // compound-body exception without raising their collision impulse.
  friction: 0.9,
  frictionStatic: 1.25,
  restitution: 0.006,
} as const;

/**
 * A sub-pixel contact cushion keeps compound wooden outlines from repeatedly
 * correcting imperceptible penetration. This softens the solver, not the
 * material: restitution remains near zero, so impacts do not become rubbery.
 */
export const WOOD_CONTACT_SLOP = 0.12;

/** A quarter second of genuinely low motion is enough to latch a wooden piece at rest. */
export const WOOD_SLEEP_THRESHOLD = 15;

/**
 * Avoid over-constraining detailed compound contacts while retaining enough
 * iterations to keep stacked silhouettes visually separated.
 */
export const WOOD_SOLVER_ITERATIONS = {
  position: 6,
  velocity: 8,
  constraint: 4,
} as const;
