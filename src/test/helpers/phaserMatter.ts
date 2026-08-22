import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { getPhysicsCollision, type AnimalDefinition } from '../../game/data/animals';
import {
  WOOD_CONTACT_SLOP,
  WOOD_SLEEP_THRESHOLD,
} from '../../game/data/woodPhysics';

export interface MatterPoint {
  readonly x: number;
  readonly y: number;
}

export interface TestMatterBody {
  readonly id: number;
  label: string;
  readonly position: MatterPoint;
  readonly velocity: MatterPoint;
  readonly bounds: {
    readonly min: MatterPoint;
    readonly max: MatterPoint;
  };
  readonly vertices: readonly MatterPoint[];
  readonly parts: readonly TestMatterBody[];
  readonly isSleeping: boolean;
  readonly angle: number;
  readonly angularVelocity: number;
  sleepThreshold: number;
}

export interface TestMatterEngine {
  readonly world: unknown;
}

interface BodiesModule {
  rectangle(x: number, y: number, width: number, height: number, options?: object): TestMatterBody;
  fromVertices(
    x: number,
    y: number,
    vertexSets: readonly MatterPoint[] | readonly (readonly MatterPoint[])[],
    options?: object,
    flagInternal?: boolean,
    removeCollinear?: number | false,
    minimumArea?: number,
    removeDuplicatePoints?: number | false,
  ): TestMatterBody;
}

interface BodyModule {
  setAngle(body: TestMatterBody, angle: number): void;
  setDensity(body: TestMatterBody, density: number): void;
}

interface CompositeModule {
  add(composite: unknown, bodies: TestMatterBody | readonly TestMatterBody[]): void;
}

interface EngineModule {
  create(options?: object): TestMatterEngine;
  update(engine: TestMatterEngine, delta?: number): void;
}

interface CollisionResult {
  readonly depth: number;
}

interface CollisionModule {
  collides(bodyA: TestMatterBody, bodyB: TestMatterBody): CollisionResult | null;
}

interface CommonModule {
  setDecomp(decomp: unknown): void;
}

const require = createRequire(import.meta.url);
const phaserRoot = dirname(require.resolve('phaser/package.json'));

function loadMatterModule<T>(relativePath: string): T {
  return require(join(phaserRoot, 'src/physics/matter-js/lib', relativePath)) as T;
}

const Bodies = loadMatterModule<BodiesModule>('factory/Bodies.js');
const Body = loadMatterModule<BodyModule>('body/Body.js');
const Composite = loadMatterModule<CompositeModule>('body/Composite.js');
const Engine = loadMatterModule<EngineModule>('core/Engine.js');
const Collision = loadMatterModule<CollisionModule>('collision/Collision.js');
const Common = loadMatterModule<CommonModule>('core/Common.js');
const decomp = require(join(phaserRoot, 'src/physics/matter-js/poly-decomp/index.js'));
Common.setDecomp(decomp);

/** Mirrors StackimalsScene.createOutlineBody without importing the browser-only Scene. */
export function createAnimalMatterBody(
  definition: AnimalDefinition,
  x = 0,
  y = 0,
  angleDeg = 0,
  options: {
    readonly isStatic?: boolean;
  } = {},
): TestMatterBody {
  const outline = getPhysicsCollision(definition).outline.map((point) => ({ x: point.x, y: point.y }));
  const body = Bodies.fromVertices(x, y, outline, {
    isStatic: options.isStatic ?? false,
    friction: definition.physics.friction,
    frictionStatic: definition.physics.frictionStatic,
    frictionAir: definition.physics.frictionAir,
    restitution: definition.physics.restitution,
    slop: WOOD_CONTACT_SLOP,
    label: `test-${definition.id}`,
  }, true, 0.01, 1);
  Body.setAngle(body, angleDeg * Math.PI / 180);
  if (!options.isStatic) {
    Body.setDensity(body, definition.physics.density);
  }
  body.sleepThreshold = WOOD_SLEEP_THRESHOLD;
  return body;
}

export function createMatterEngine(): TestMatterEngine {
  return Engine.create({
    enableSleeping: true,
    gravity: { x: 0, y: 1.05, scale: 0.001 },
    positionIterations: 10,
    velocityIterations: 8,
    constraintIterations: 4,
  });
}

export function createRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  options: object = {},
): TestMatterBody {
  return Bodies.rectangle(x, y, width, height, options);
}

export function addToMatterWorld(
  engine: TestMatterEngine,
  bodies: TestMatterBody | readonly TestMatterBody[],
): void {
  Composite.add(engine.world, bodies);
}

export function stepMatter(engine: TestMatterEngine, frames: number, delta = 1000 / 60): void {
  for (let frame = 0; frame < frames; frame += 1) {
    Engine.update(engine, delta);
  }
}

function collisionParts(body: TestMatterBody): readonly TestMatterBody[] {
  return body.parts.length > 1 ? body.parts.slice(1) : body.parts;
}

export function compoundCollisionDepths(
  bodyA: TestMatterBody,
  bodyB: TestMatterBody,
): readonly number[] {
  const depths: number[] = [];
  for (const partA of collisionParts(bodyA)) {
    for (const partB of collisionParts(bodyB)) {
      const collision = Collision.collides(partA, partB);
      if (collision !== null) {
        depths.push(collision.depth);
      }
    }
  }
  return depths;
}

export function childParts(body: TestMatterBody): readonly TestMatterBody[] {
  return collisionParts(body);
}
