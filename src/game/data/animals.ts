import { ANIMAL_IDS, type AnimalId } from '../core/types';

export type CollisionPart =
  | {
      readonly shape: 'box';
      readonly offsetX: number;
      readonly offsetY: number;
      readonly width: number;
      readonly height: number;
      readonly rotationDeg?: number;
    }
  | {
      readonly shape: 'circle';
      readonly offsetX: number;
      readonly offsetY: number;
      readonly radius: number;
    };

export interface AnimalDefinition {
  readonly id: AnimalId;
  readonly name: string;
  readonly nameZh: string;
  readonly assetKey: `animal-${AnimalId}`;
  readonly texturePath: `/assets/game/animals/${AnimalId}.webp`;
  /** Logical display size at the game's base resolution. */
  readonly display: {
    readonly width: number;
    readonly height: number;
  };
  readonly physics: {
    readonly density: number;
    readonly friction: number;
    readonly frictionStatic: number;
    readonly restitution: number;
    readonly frictionAir: number;
  };
  /** Degrees. The UI and AI must only choose values from this list. */
  readonly allowedAngles: readonly number[];
  /** Compound-body parts, centered on the displayed texture. */
  readonly collisionParts: readonly CollisionPart[];
}

const ANGLES_30 = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180] as const;
const ANGLES_45 = [-135, -90, -45, 0, 45, 90, 135, 180] as const;

export const ANIMAL_CATALOG: Readonly<Record<AnimalId, AnimalDefinition>> = {
  bear: {
    id: 'bear',
    name: 'Bear',
    nameZh: '小熊',
    assetKey: 'animal-bear',
    texturePath: '/assets/game/animals/bear.webp',
    display: { width: 98, height: 82 },
    physics: { density: 0.00145, friction: 0.72, frictionStatic: 0.88, restitution: 0.025, frictionAir: 0.012 },
    allowedAngles: ANGLES_30,
    collisionParts: [
      { shape: 'box', offsetX: -4, offsetY: 9, width: 69, height: 43, rotationDeg: -2 },
      { shape: 'circle', offsetX: 29, offsetY: -12, radius: 22 },
      { shape: 'circle', offsetX: -30, offsetY: 12, radius: 18 },
    ],
  },
  bird: {
    id: 'bird',
    name: 'Bird',
    nameZh: '小鸟',
    assetKey: 'animal-bird',
    texturePath: '/assets/game/animals/bird.webp',
    display: { width: 58, height: 55 },
    physics: { density: 0.00105, friction: 0.63, frictionStatic: 0.8, restitution: 0.055, frictionAir: 0.015 },
    allowedAngles: ANGLES_45,
    collisionParts: [
      { shape: 'circle', offsetX: -4, offsetY: 5, radius: 20 },
      { shape: 'circle', offsetX: 13, offsetY: -10, radius: 13 },
      { shape: 'box', offsetX: -21, offsetY: 7, width: 18, height: 11, rotationDeg: -18 },
    ],
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    nameZh: '小猫',
    assetKey: 'animal-cat',
    texturePath: '/assets/game/animals/cat.webp',
    display: { width: 72, height: 74 },
    physics: { density: 0.00115, friction: 0.7, frictionStatic: 0.86, restitution: 0.04, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
    collisionParts: [
      { shape: 'box', offsetX: -7, offsetY: 12, width: 39, height: 43, rotationDeg: 4 },
      { shape: 'circle', offsetX: 9, offsetY: -17, radius: 20 },
      { shape: 'box', offsetX: -29, offsetY: 3, width: 22, height: 10, rotationDeg: -30 },
    ],
  },
  fox: {
    id: 'fox',
    name: 'Fox',
    nameZh: '小狐狸',
    assetKey: 'animal-fox',
    texturePath: '/assets/game/animals/fox.webp',
    display: { width: 92, height: 68 },
    physics: { density: 0.00118, friction: 0.68, frictionStatic: 0.84, restitution: 0.045, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
    collisionParts: [
      { shape: 'box', offsetX: -3, offsetY: 9, width: 54, height: 34, rotationDeg: -3 },
      { shape: 'circle', offsetX: 25, offsetY: -11, radius: 18 },
      { shape: 'box', offsetX: -34, offsetY: 2, width: 31, height: 16, rotationDeg: 22 },
    ],
  },
  hedgehog: {
    id: 'hedgehog',
    name: 'Hedgehog',
    nameZh: '小刺猬',
    assetKey: 'animal-hedgehog',
    texturePath: '/assets/game/animals/hedgehog.webp',
    display: { width: 82, height: 58 },
    physics: { density: 0.00125, friction: 0.79, frictionStatic: 0.92, restitution: 0.02, frictionAir: 0.014 },
    allowedAngles: ANGLES_45,
    collisionParts: [
      { shape: 'circle', offsetX: -8, offsetY: 5, radius: 27 },
      { shape: 'circle', offsetX: 24, offsetY: 8, radius: 16 },
      { shape: 'box', offsetX: 33, offsetY: 9, width: 20, height: 11, rotationDeg: 4 },
    ],
  },
  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    nameZh: '小兔',
    assetKey: 'animal-rabbit',
    texturePath: '/assets/game/animals/rabbit.webp',
    display: { width: 68, height: 90 },
    physics: { density: 0.0011, friction: 0.71, frictionStatic: 0.87, restitution: 0.04, frictionAir: 0.014 },
    allowedAngles: ANGLES_30,
    collisionParts: [
      { shape: 'circle', offsetX: -4, offsetY: 17, radius: 25 },
      { shape: 'circle', offsetX: 7, offsetY: -14, radius: 19 },
      { shape: 'box', offsetX: -3, offsetY: -38, width: 15, height: 35, rotationDeg: -7 },
      { shape: 'box', offsetX: 13, offsetY: -37, width: 13, height: 34, rotationDeg: 8 },
    ],
  },
  raccoon: {
    id: 'raccoon',
    name: 'Raccoon',
    nameZh: '小浣熊',
    assetKey: 'animal-raccoon',
    texturePath: '/assets/game/animals/raccoon.webp',
    display: { width: 86, height: 70 },
    physics: { density: 0.00122, friction: 0.74, frictionStatic: 0.89, restitution: 0.035, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
    collisionParts: [
      { shape: 'box', offsetX: 0, offsetY: 10, width: 49, height: 37, rotationDeg: 2 },
      { shape: 'circle', offsetX: 12, offsetY: -14, radius: 20 },
      { shape: 'box', offsetX: -31, offsetY: 0, width: 32, height: 15, rotationDeg: -24 },
    ],
  },
  turtle: {
    id: 'turtle',
    name: 'Turtle',
    nameZh: '小龟',
    assetKey: 'animal-turtle',
    texturePath: '/assets/game/animals/turtle.webp',
    display: { width: 94, height: 52 },
    physics: { density: 0.00135, friction: 0.82, frictionStatic: 0.95, restitution: 0.018, frictionAir: 0.012 },
    allowedAngles: ANGLES_45,
    collisionParts: [
      { shape: 'box', offsetX: -6, offsetY: 1, width: 61, height: 31 },
      { shape: 'circle', offsetX: 30, offsetY: -1, radius: 14 },
      { shape: 'circle', offsetX: -35, offsetY: 2, radius: 10 },
    ],
  },
};

export const ANIMALS: readonly AnimalDefinition[] = ANIMAL_IDS.map((id) => ANIMAL_CATALOG[id]);

export function getAnimalDefinition(id: AnimalId): AnimalDefinition {
  return ANIMAL_CATALOG[id];
}
