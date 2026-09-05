/** Shared Matter contact values for the side-view wooden platform. */
export const WOOD_PLATFORM_PHYSICS = {
  // Matter takes the lower kinetic friction of the two contacting bodies, so
  // animals determine the impact response on both wood and other animals.
  friction: 0.9,
  frictionStatic: 1.25,
  restitution: 0.006,
} as const;

/**
 * Large friction impulses on changing compound contact normals can turn a
 * glancing hit into repeated upward kicks despite near-zero restitution.
 * Share a low sliding coefficient; shape, density and static friction still
 * distinguish the animals. Raising static friction to compensate reintroduces
 * those kicks, so validate animal-on-animal impacts when changing either value.
 */
export const WOOD_ANIMAL_FRICTION = 0.11;

/** Resolve angled contacts twice per 60 Hz frame, with bounded catch-up work. */
export const WOOD_RUNNER = {
  fps: 120,
  maxUpdates: 6,
  maxFrameTime: 50,
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
