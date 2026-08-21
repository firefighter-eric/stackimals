import type { AABB, AnimalId, HorizontalSpan, StackBodySnapshot } from '../core/types';
import { SeededRandom, type RandomSeed } from '../core/prng';
import { getAnimalDefinition } from '../data/animals';

const EPSILON = 1e-6;

export interface StackAnalysis {
  readonly towerBounds: AABB | null;
  readonly towerCenterX: number;
  readonly topY: number | null;
  readonly supportSpans: readonly HorizontalSpan[];
  readonly supportCenterX: number;
  readonly supportBodyIds: readonly string[];
  readonly massProxy: number;
}

export interface AIPlacementContext {
  readonly animalId: AnimalId;
  readonly bodies: readonly StackBodySnapshot[];
  /** The top-facing horizontal extent of the base platform. */
  readonly platform: HorizontalSpan;
  /** Horizontal area the full rotated animal must stay within. */
  readonly playfield?: HorizontalSpan;
}

export interface AIPlacementDecision {
  readonly x: number;
  /** Degrees, always one of the animal definition's allowed angles. */
  readonly angle: number;
  readonly score: number;
  readonly supportRatio: number;
  readonly towerCenterX: number;
  readonly supportSpans: readonly HorizontalSpan[];
  readonly usedFallback: boolean;
}

interface Candidate {
  readonly x: number;
  readonly angle: number;
  readonly width: number;
  readonly height: number;
}

function assertSpan(span: HorizontalSpan, label: string): void {
  if (!Number.isFinite(span.minX) || !Number.isFinite(span.maxX) || span.maxX <= span.minX) {
    throw new RangeError(`${label} must have finite bounds where maxX > minX.`);
  }
}

function isValidAABB(aabb: AABB): boolean {
  return Number.isFinite(aabb.minX)
    && Number.isFinite(aabb.maxX)
    && Number.isFinite(aabb.minY)
    && Number.isFinite(aabb.maxY)
    && aabb.maxX > aabb.minX
    && aabb.maxY > aabb.minY;
}

function center(span: HorizontalSpan): number {
  return (span.minX + span.maxX) / 2;
}

function width(span: HorizontalSpan): number {
  return span.maxX - span.minX;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mergeSpans(spans: readonly HorizontalSpan[], maxGap = 4): HorizontalSpan[] {
  const sorted = [...spans].sort((left, right) => left.minX - right.minX);
  const merged: Array<{ minX: number; maxX: number }> = [];

  for (const span of sorted) {
    const previous = merged[merged.length - 1];
    if (previous === undefined || span.minX > previous.maxX + maxGap) {
      merged.push({ minX: span.minX, maxX: span.maxX });
    } else {
      previous.maxX = Math.max(previous.maxX, span.maxX);
    }
  }

  return merged;
}

export function analyzeStack(
  bodies: readonly StackBodySnapshot[],
  platform: HorizontalSpan,
): StackAnalysis {
  assertSpan(platform, 'Platform');
  const validBodies = bodies.filter((body) => isValidAABB(body.aabb));
  if (validBodies.length === 0) {
    return {
      towerBounds: null,
      towerCenterX: center(platform),
      topY: null,
      supportSpans: [platform],
      supportCenterX: center(platform),
      supportBodyIds: [],
      massProxy: 0,
    };
  }

  const towerBounds = validBodies.reduce<AABB>((bounds, body) => ({
    minX: Math.min(bounds.minX, body.aabb.minX),
    maxX: Math.max(bounds.maxX, body.aabb.maxX),
    minY: Math.min(bounds.minY, body.aabb.minY),
    maxY: Math.max(bounds.maxY, body.aabb.maxY),
  }), validBodies[0]!.aabb);

  let weightedCenter = 0;
  let massProxy = 0;
  for (const body of validBodies) {
    const area = width(body.aabb) * (body.aabb.maxY - body.aabb.minY);
    weightedCenter += center(body.aabb) * area;
    massProxy += area;
  }

  const topY = towerBounds.minY;
  const averageHeight = validBodies.reduce(
    (sum, body) => sum + (body.aabb.maxY - body.aabb.minY),
    0,
  ) / validBodies.length;
  const topTolerance = Math.max(14, Math.min(30, averageHeight * 0.32));
  const supportBodies = validBodies.filter((body) => body.aabb.minY <= topY + topTolerance);
  const supportSpans = mergeSpans(supportBodies.map((body) => ({
    minX: body.aabb.minX,
    maxX: body.aabb.maxX,
  })));

  let supportWeightedCenter = 0;
  let supportWidth = 0;
  for (const span of supportSpans) {
    supportWeightedCenter += center(span) * width(span);
    supportWidth += width(span);
  }

  return {
    towerBounds,
    towerCenterX: massProxy > 0 ? weightedCenter / massProxy : center(platform),
    topY,
    supportSpans,
    supportCenterX: supportWidth > 0 ? supportWeightedCenter / supportWidth : center(platform),
    supportBodyIds: supportBodies.map((body) => body.id),
    massProxy,
  };
}

export function rotatedDisplaySize(animalId: AnimalId, angleDeg: number): { width: number; height: number } {
  const display = getAnimalDefinition(animalId).display;
  const radians = angleDeg * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: display.width * cosine + display.height * sine,
    height: display.width * sine + display.height * cosine,
  };
}

function overlapLength(footprint: HorizontalSpan, spans: readonly HorizontalSpan[]): number {
  return spans.reduce((total, span) => (
    total + Math.max(0, Math.min(footprint.maxX, span.maxX) - Math.max(footprint.minX, span.minX))
  ), 0);
}

function candidateScore(
  candidate: Candidate,
  analysis: StackAnalysis,
  platform: HorizontalSpan,
  playfield: HorizontalSpan,
  animalArea: number,
  random: SeededRandom,
): { score: number; supportRatio: number } {
  const halfWidth = candidate.width / 2;
  const footprint = { minX: candidate.x - halfWidth, maxX: candidate.x + halfWidth };
  const supportRatio = clamp(overlapLength(footprint, analysis.supportSpans) / candidate.width, 0, 1);
  const supportDistance = Math.abs(candidate.x - analysis.supportCenterX);
  const supportScale = Math.max(candidate.width, ...analysis.supportSpans.map(width));
  const supportCenterScore = 1 - clamp(supportDistance / Math.max(supportScale, 1), 0, 1);

  const towerScale = Math.max(width(platform), candidate.width);
  const towerCenterScore = 1 - clamp(Math.abs(candidate.x - analysis.towerCenterX) / towerScale, 0, 1);
  const projectedMass = analysis.massProxy + animalArea;
  const projectedCenter = projectedMass > 0
    ? (analysis.towerCenterX * analysis.massProxy + candidate.x * animalArea) / projectedMass
    : candidate.x;
  const halfPlatform = width(platform) / 2;
  const balanceScore = 1 - clamp(Math.abs(projectedCenter - center(platform)) / Math.max(halfPlatform, 1), 0, 1);
  const broadSideScore = candidate.width / Math.max(candidate.width, candidate.height);
  const sideMargin = Math.min(footprint.minX - playfield.minX, playfield.maxX - footprint.maxX);
  const marginScore = clamp(sideMargin / Math.max(width(playfield) * 0.18, 1), 0, 1);

  return {
    score: supportRatio * 5
      + supportCenterScore * 1.8
      + towerCenterScore * 1.5
      + balanceScore * 1.8
      + broadSideScore * 0.65
      + marginScore * 0.35
      + random.next() * 0.025,
    supportRatio,
  };
}

function addCandidateX(target: number[], value: number): void {
  if (Number.isFinite(value) && !target.some((existing) => Math.abs(existing - value) < 0.2)) {
    target.push(value);
  }
}

/** Pure deterministic placement choice for a given seed and stack snapshot. */
export function chooseAIPlacement(
  context: AIPlacementContext,
  seed: RandomSeed,
): AIPlacementDecision {
  assertSpan(context.platform, 'Platform');
  const playfield = context.playfield ?? context.platform;
  assertSpan(playfield, 'Playfield');

  const animal = getAnimalDefinition(context.animalId);
  const random = new SeededRandom(seed);
  const analysis = analyzeStack(context.bodies, context.platform);
  const xAnchors: number[] = [];
  addCandidateX(xAnchors, analysis.towerCenterX);
  addCandidateX(xAnchors, analysis.supportCenterX);
  addCandidateX(xAnchors, center(context.platform));

  for (const span of analysis.supportSpans) {
    addCandidateX(xAnchors, center(span));
    for (let step = 1; step <= 5; step += 1) {
      addCandidateX(xAnchors, span.minX + width(span) * step / 6);
    }
  }

  // Reproducible exploratory anchors stop the AI feeling completely mechanical.
  for (let index = 0; index < 5; index += 1) {
    const support = random.pick(analysis.supportSpans);
    addCandidateX(xAnchors, random.range(support.minX, support.maxX));
  }

  const candidates: Candidate[] = [];
  for (const angle of animal.allowedAngles) {
    const size = rotatedDisplaySize(context.animalId, angle);
    const legalMin = playfield.minX + size.width / 2;
    const legalMax = playfield.maxX - size.width / 2;
    if (legalMin > legalMax + EPSILON) {
      continue;
    }

    for (const anchor of xAnchors) {
      const x = clamp(anchor, legalMin, legalMax);
      if (!candidates.some((candidate) => candidate.angle === angle && Math.abs(candidate.x - x) < 0.2)) {
        candidates.push({ x, angle, width: size.width, height: size.height });
      }
    }
  }

  let best: AIPlacementDecision | undefined;
  const animalArea = animal.display.width * animal.display.height;
  for (const candidate of candidates) {
    const result = candidateScore(candidate, analysis, context.platform, playfield, animalArea, random);
    if (best === undefined || result.score > best.score) {
      best = {
        x: candidate.x,
        angle: candidate.angle,
        score: result.score,
        supportRatio: result.supportRatio,
        towerCenterX: analysis.towerCenterX,
        supportSpans: analysis.supportSpans,
        usedFallback: false,
      };
    }
  }

  if (best !== undefined) {
    return best;
  }

  // Only reached if the playfield is narrower than the animal at every angle.
  const fallbackAngle = [...animal.allowedAngles].sort((left, right) => (
    rotatedDisplaySize(context.animalId, left).width - rotatedDisplaySize(context.animalId, right).width
  ))[0] ?? 0;
  return {
    x: clamp(analysis.supportCenterX, playfield.minX, playfield.maxX),
    angle: fallbackAngle,
    score: Number.NEGATIVE_INFINITY,
    supportRatio: 0,
    towerCenterX: analysis.towerCenterX,
    supportSpans: analysis.supportSpans,
    usedFallback: true,
  };
}

/** Stateful facade for a match. Each turn derives a fresh deterministic seed. */
export class StackingAI {
  private readonly random: SeededRandom;

  constructor(seed: RandomSeed) {
    this.random = new SeededRandom(seed);
  }

  choosePlacement(context: AIPlacementContext): AIPlacementDecision {
    return chooseAIPlacement(context, this.random.nextUint32());
  }
}
