import { getPhysicsCollision, type AnimalDefinition } from '../../game/data/animals';
import { childParts, createAnimalMatterBody, type MatterPoint } from './phaserMatter';
import {
  decodeRgbaPngAlpha,
  decodeWebpAlpha,
  findAlphaBounds,
  readWebpSize,
  type PixelBounds,
} from './imageAlpha';

export interface LogicalBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface ColliderAlphaMetrics {
  readonly sourceTrim: PixelBounds;
  readonly opaqueBounds: LogicalBounds;
  readonly colliderBounds: LogicalBounds;
  readonly webpSize: { readonly width: number; readonly height: number };
  readonly sourceTrimAspectError: number;
  readonly opaqueCoveredByCollider: number;
  readonly colliderCoveredByOpaque: number;
}

function boundsFromPoints(points: readonly MatterPoint[]): LogicalBounds {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function pointInPolygon(point: MatterPoint, vertices: readonly MatterPoint[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = vertices.length - 1;
    current < vertices.length;
    previous = current, current += 1
  ) {
    const a = vertices[current]!;
    const b = vertices[previous]!;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function logicalPoint(
  pixelX: number,
  pixelY: number,
  trim: PixelBounds,
  display: AnimalDefinition['display'],
): MatterPoint {
  return {
    x: (pixelX + 0.5 - trim.minX) / trim.width * display.width,
    y: (pixelY + 0.5 - trim.minY) / trim.height * display.height,
  };
}

function alphaAtLogicalPoint(
  logicalX: number,
  logicalY: number,
  definition: AnimalDefinition,
  source: ReturnType<typeof decodeRgbaPngAlpha>,
  trim: PixelBounds,
): number {
  const physicsCollision = getPhysicsCollision(definition);
  const originX = physicsCollision.textureOrigin.x * definition.display.width;
  const originY = physicsCollision.textureOrigin.y * definition.display.height;
  const sourceX = Math.max(
    trim.minX,
    Math.min(
      trim.maxX,
      Math.floor((logicalX + originX) / definition.display.width * trim.width + trim.minX),
    ),
  );
  const sourceY = Math.max(
    trim.minY,
    Math.min(
      trim.maxY,
      Math.floor((logicalY + originY) / definition.display.height * trim.height + trim.minY),
    ),
  );
  return source.alpha[sourceY * source.width + sourceX]!;
}

function toLogicalBounds(
  bounds: PixelBounds,
  trim: PixelBounds,
  display: AnimalDefinition['display'],
): LogicalBounds {
  const min = logicalPoint(bounds.minX - 0.5, bounds.minY - 0.5, trim, display);
  const max = logicalPoint(bounds.maxX + 0.5, bounds.maxY + 0.5, trim, display);
  return {
    minX: min.x,
    maxX: max.x,
    minY: min.y,
    maxY: max.y,
    width: max.x - min.x,
    height: max.y - min.y,
  };
}

export async function collectColliderAlphaMetrics(definition: AnimalDefinition): Promise<ColliderAlphaMetrics> {
  const physicsCollision = getPhysicsCollision(definition);
  const sourceUrl = new URL(`../../../assets-src/generated-v1/${definition.id}.png`, import.meta.url);
  const webpUrl = new URL(`../../../public${definition.texturePath}`, import.meta.url);
  const original = decodeRgbaPngAlpha(sourceUrl);
  const originalTrim = findAlphaBounds(original, 1);
  const source = await decodeWebpAlpha(webpUrl);
  const sourceTrim = { minX: 0, minY: 0, maxX: source.width - 1, maxY: source.height - 1, width: source.width, height: source.height };
  const alphaThreshold = definition.collision.fit.alphaThreshold;
  const meaningfulAlpha = findAlphaBounds(source, alphaThreshold);
  const webpSize = readWebpSize(webpUrl);
  const sourceTrimAspect = originalTrim.width / originalTrim.height;
  const webpAspect = webpSize.width / webpSize.height;

  const body = createAnimalMatterBody(definition);
  const polygons = childParts(body).map((part) => part.vertices);
  const colliderBounds = boundsFromPoints(polygons.flat());
  const rawOpaqueBounds = toLogicalBounds(meaningfulAlpha, sourceTrim, definition.display);
  const originX = physicsCollision.textureOrigin.x * definition.display.width;
  const originY = physicsCollision.textureOrigin.y * definition.display.height;
  const opaqueBounds = {
    minX: rawOpaqueBounds.minX - originX,
    maxX: rawOpaqueBounds.maxX - originX,
    minY: rawOpaqueBounds.minY - originY,
    maxY: rawOpaqueBounds.maxY - originY,
    width: rawOpaqueBounds.width,
    height: rawOpaqueBounds.height,
  };

  let opaqueSamples = 0;
  let coveredOpaqueSamples = 0;
  const sourceSampleStep = Math.max(
    2,
    Math.round(Math.min(sourceTrim.width, sourceTrim.height) / 240),
  );
  for (let y = sourceTrim.minY; y <= sourceTrim.maxY; y += sourceSampleStep) {
    for (let x = sourceTrim.minX; x <= sourceTrim.maxX; x += sourceSampleStep) {
      if (source.alpha[y * source.width + x]! < alphaThreshold) {
        continue;
      }
      opaqueSamples += 1;
      const rawPoint = logicalPoint(x, y, sourceTrim, definition.display);
      const point = { x: rawPoint.x - originX, y: rawPoint.y - originY };
      if (polygons.some((vertices) => pointInPolygon(point, vertices))) {
        coveredOpaqueSamples += 1;
      }
    }
  }

  let colliderSamples = 0;
  let opaqueColliderSamples = 0;
  for (let y = -originY; y <= definition.display.height - originY; y += 1) {
    for (let x = -originX; x <= definition.display.width - originX; x += 1) {
      if (!polygons.some((vertices) => pointInPolygon({ x, y }, vertices))) {
        continue;
      }
      colliderSamples += 1;
      if (alphaAtLogicalPoint(x, y, definition, source, sourceTrim) >= alphaThreshold) {
        opaqueColliderSamples += 1;
      }
    }
  }

  return {
    sourceTrim,
    opaqueBounds,
    colliderBounds,
    webpSize,
    sourceTrimAspectError: Math.abs(sourceTrimAspect - webpAspect) / webpAspect,
    opaqueCoveredByCollider: coveredOpaqueSamples / opaqueSamples,
    colliderCoveredByOpaque: opaqueColliderSamples / colliderSamples,
  };
}

export function polygonSignedArea(vertices: readonly MatterPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

export function isConvexPolygon(vertices: readonly MatterPoint[], epsilon = 1e-7): boolean {
  let sign = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index]!;
    const b = vertices[(index + 1) % vertices.length]!;
    const c = vertices[(index + 2) % vertices.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) <= epsilon) {
      continue;
    }
    const currentSign = Math.sign(cross);
    if (sign !== 0 && currentSign !== sign) {
      return false;
    }
    sign = currentSign;
  }
  return sign !== 0;
}
