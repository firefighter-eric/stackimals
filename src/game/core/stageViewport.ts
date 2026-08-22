interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface StageViewportFit {
  readonly zoom: number;
  readonly visibleWorldWidth: number;
  readonly visibleWorldHeight: number;
}

function assertPositiveDimensions(label: string, dimensions: Dimensions): void {
  if (
    !Number.isFinite(dimensions.width) || dimensions.width <= 0 ||
    !Number.isFinite(dimensions.height) || dimensions.height <= 0
  ) {
    throw new RangeError(`${label} dimensions must be finite and positive`);
  }
}

/**
 * Fits the complete fixed-height game world inside a responsive canvas.
 * Extra aspect-ratio space remains visible instead of narrowing the canvas,
 * so animals can overhang the platform without being visually clipped.
 */
export function fitStageViewport(
  viewport: Dimensions,
  world: Dimensions,
): StageViewportFit {
  assertPositiveDimensions('Viewport', viewport);
  assertPositiveDimensions('World', world);

  const zoom = Math.min(viewport.width / world.width, viewport.height / world.height);
  return {
    zoom,
    visibleWorldWidth: viewport.width / zoom,
    visibleWorldHeight: viewport.height / zoom,
  };
}
