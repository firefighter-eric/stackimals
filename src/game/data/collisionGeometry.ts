import type { Point } from '../core/types';

const EPSILON = 1e-8;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Bounds use pixel-edge coordinates, so max values are exclusive. */
export interface RectBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CollisionFit {
  /** Alpha threshold used by the offline contour extraction. */
  readonly alphaThreshold: number;
  /** Fraction of thresholded opaque pixels covered by the simplified outline. */
  readonly opaqueCoverage: number;
  /** Fraction of the simplified outline area that is thresholded opaque. */
  readonly outlinePrecision: number;
}

/**
 * A single simple concave outline in displayed-texture coordinates. Matter's
 * fromVertices can decompose it while preserving the relative position of all
 * generated convex chunks.
 */
export interface CollisionGeometry {
  readonly outline: readonly Point[];
  /** Normalized texture origin matching the outline's area centroid. */
  readonly textureOrigin: Point;
  readonly sourceAlphaBounds: RectBounds;
  readonly alphaBounds: RectBounds;
  readonly fit: CollisionFit;
}

export type PixelVertex = readonly [x: number, y: number];

export function displaySizeForWidth(sourceSize: Size, targetWidth: number): Size {
  if (
    sourceSize.width <= 0
    || sourceSize.height <= 0
    || !Number.isFinite(sourceSize.width)
    || !Number.isFinite(sourceSize.height)
    || !Number.isFinite(targetWidth)
    || targetWidth <= 0
  ) {
    throw new RangeError('Source dimensions and target width must be finite and positive.');
  }

  const uniformScale = targetWidth / sourceSize.width;
  return {
    width: sourceSize.width * uniformScale,
    height: sourceSize.height * uniformScale,
  };
}

export function polygonSignedArea(vertices: readonly Point[]): number {
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (current !== undefined && next !== undefined) {
      twiceArea += current.x * next.y - next.x * current.y;
    }
  }
  return twiceArea / 2;
}

export function polygonCentroid(vertices: readonly Point[]): Point {
  const area = polygonSignedArea(vertices);
  if (Math.abs(area) <= EPSILON) {
    throw new RangeError('Collision outline must have non-zero area.');
  }

  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (current !== undefined && next !== undefined) {
      const cross = current.x * next.y - next.x * current.y;
      weightedX += (current.x + next.x) * cross;
      weightedY += (current.y + next.y) * cross;
    }
  }

  const factor = 1 / (6 * area);
  return { x: weightedX * factor, y: weightedY * factor };
}

export function polygonBounds(vertices: readonly Point[]): RectBounds {
  if (vertices.length === 0) {
    throw new RangeError('Cannot calculate bounds for an empty outline.');
  }

  return vertices.reduce<RectBounds>((bounds, vertex) => ({
    minX: Math.min(bounds.minX, vertex.x),
    minY: Math.min(bounds.minY, vertex.y),
    maxX: Math.max(bounds.maxX, vertex.x),
    maxY: Math.max(bounds.maxY, vertex.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function cross(first: Point, second: Point, third: Point): number {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function isPointOnSegment(point: Point, start: Point, end: Point): boolean {
  return Math.abs(cross(start, end, point)) <= EPSILON
    && point.x >= Math.min(start.x, end.x) - EPSILON
    && point.x <= Math.max(start.x, end.x) + EPSILON
    && point.y >= Math.min(start.y, end.y) - EPSILON
    && point.y <= Math.max(start.y, end.y) + EPSILON;
}

function segmentsIntersect(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point): boolean {
  const firstSideA = cross(firstStart, firstEnd, secondStart);
  const firstSideB = cross(firstStart, firstEnd, secondEnd);
  const secondSideA = cross(secondStart, secondEnd, firstStart);
  const secondSideB = cross(secondStart, secondEnd, firstEnd);

  if (
    ((firstSideA > EPSILON && firstSideB < -EPSILON) || (firstSideA < -EPSILON && firstSideB > EPSILON))
    && ((secondSideA > EPSILON && secondSideB < -EPSILON) || (secondSideA < -EPSILON && secondSideB > EPSILON))
  ) {
    return true;
  }

  return (Math.abs(firstSideA) <= EPSILON && isPointOnSegment(secondStart, firstStart, firstEnd))
    || (Math.abs(firstSideB) <= EPSILON && isPointOnSegment(secondEnd, firstStart, firstEnd))
    || (Math.abs(secondSideA) <= EPSILON && isPointOnSegment(firstStart, secondStart, secondEnd))
    || (Math.abs(secondSideB) <= EPSILON && isPointOnSegment(firstEnd, secondStart, secondEnd));
}

export function isSimplePolygon(vertices: readonly Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }

  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    const firstStart = vertices[firstIndex];
    const firstEnd = vertices[(firstIndex + 1) % vertices.length];
    if (firstStart === undefined || firstEnd === undefined) {
      return false;
    }

    for (let secondIndex = firstIndex + 1; secondIndex < vertices.length; secondIndex += 1) {
      const secondStart = vertices[secondIndex];
      const secondEnd = vertices[(secondIndex + 1) % vertices.length];
      if (secondStart === undefined || secondEnd === undefined) {
        return false;
      }

      const adjacent = secondIndex === firstIndex
        || secondIndex === firstIndex + 1
        || (firstIndex === 0 && secondIndex === vertices.length - 1);
      if (!adjacent && segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return false;
      }
    }
  }

  return true;
}

export function isConvexPolygon(vertices: readonly Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }

  let direction = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const first = vertices[index];
    const second = vertices[(index + 1) % vertices.length];
    const third = vertices[(index + 2) % vertices.length];
    if (first === undefined || second === undefined || third === undefined) {
      return false;
    }

    const turn = cross(first, second, third);
    if (Math.abs(turn) <= EPSILON) {
      continue;
    }
    const nextDirection = Math.sign(turn);
    if (direction !== 0 && nextDirection !== direction) {
      return false;
    }
    direction = nextDirection;
  }

  return direction !== 0;
}

export interface CollisionGeometryInput {
  readonly sourceSize: Size;
  readonly display: Size;
  readonly sourceAlphaBounds: RectBounds;
  readonly sourceOutline: readonly PixelVertex[];
  readonly fit: CollisionFit;
}

/** Scale an alpha-derived source outline into the displayed texture space. */
export function createCollisionGeometry(input: CollisionGeometryInput): CollisionGeometry {
  const { sourceSize, display, sourceAlphaBounds, sourceOutline, fit } = input;
  if (sourceOutline.length < 3) {
    throw new RangeError('Collision outline requires at least three vertices.');
  }

  const sourceAspect = sourceSize.width / sourceSize.height;
  const displayAspect = display.width / display.height;
  if (Math.abs(sourceAspect - displayAspect) > EPSILON) {
    throw new RangeError('Display size must preserve the source texture aspect ratio.');
  }

  const scaleX = display.width / sourceSize.width;
  const scaleY = display.height / sourceSize.height;
  const outline = sourceOutline.map(([x, y]) => ({ x: x * scaleX, y: y * scaleY }));
  const bounds = polygonBounds(outline);
  if (
    bounds.minX < -EPSILON
    || bounds.minY < -EPSILON
    || bounds.maxX > display.width + EPSILON
    || bounds.maxY > display.height + EPSILON
  ) {
    throw new RangeError('Collision outline must stay inside the displayed texture.');
  }
  if (!isSimplePolygon(outline)) {
    throw new RangeError('Collision outline must be simple and non-self-intersecting.');
  }

  const centroid = polygonCentroid(outline);
  return {
    outline,
    textureOrigin: {
      x: centroid.x / display.width,
      y: centroid.y / display.height,
    },
    sourceAlphaBounds,
    alphaBounds: {
      minX: sourceAlphaBounds.minX * scaleX,
      minY: sourceAlphaBounds.minY * scaleY,
      maxX: sourceAlphaBounds.maxX * scaleX,
      maxY: sourceAlphaBounds.maxY * scaleY,
    },
    fit,
  };
}
