import { ANIMAL_IDS, type AnimalId } from '../core/types';
import {
  createCollisionGeometry,
  displaySizeForArea,
  type CollisionFit,
  type CollisionGeometry,
  type PixelVertex,
  type RectBounds,
  type Size,
} from './collisionGeometry';

export type {
  CollisionFit,
  CollisionGeometry,
  PixelVertex,
  RectBounds,
  Size,
} from './collisionGeometry';

export interface AnimalDefinition {
  readonly id: AnimalId;
  readonly name: string;
  readonly nameZh: string;
  readonly assetKey: `animal-${AnimalId}`;
  readonly texturePath: `/assets/game/animals/${AnimalId}.webp`;
  /** The encoded WebP canvas, before Phaser display scaling. */
  readonly sourceSize: Size;
  /** Logical display size; always the exact source WebP aspect ratio. */
  readonly display: Size;
  readonly physics: {
    readonly density: number;
    readonly friction: number;
    readonly frictionStatic: number;
    readonly restitution: number;
    readonly frictionAir: number;
  };
  /** Degrees. The UI and AI must only choose values from this list. */
  readonly allowedAngles: readonly number[];
  /** Alpha-derived, renderer-independent collision geometry. */
  readonly collision: CollisionGeometry;
}

const ANGLES_30 = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180] as const;
const ANGLES_45 = [-135, -90, -45, 0, 45, 90, 135, 180] as const;

function animalGeometry(
  sourceSize: Size,
  targetArea: number,
  sourceAlphaBounds: RectBounds,
  sourceOutline: readonly PixelVertex[],
  fit: CollisionFit,
): Pick<AnimalDefinition, 'sourceSize' | 'display' | 'collision'> {
  const display = displaySizeForArea(sourceSize, targetArea);
  return {
    sourceSize,
    display,
    collision: createCollisionGeometry({
      sourceSize,
      display,
      sourceAlphaBounds,
      sourceOutline,
      fit,
    }),
  };
}

/**
 * Outlines were traced from alpha >= 48 and simplified at an 8px source-space
 * tolerance. Coordinates below are source pixel-edge coordinates; the helper
 * scales them into each definition's displayed-texture coordinate system.
 */
const GEOMETRY: Readonly<Record<AnimalId, Pick<AnimalDefinition, 'sourceSize' | 'display' | 'collision'>>> = {
  bear: animalGeometry(
    { width: 600, height: 397 },
    98 * 82,
    { minX: 60, minY: 5, maxX: 598, maxY: 374 },
    [
      [60, 159], [80, 91], [127, 49], [347, 41], [360, 17], [385, 5], [417, 12], [432, 32],
      [455, 8], [489, 10], [505, 28], [506, 58], [534, 81], [552, 118], [583, 128], [598, 147],
      [591, 195], [570, 227], [480, 263], [473, 361], [404, 374], [322, 370], [308, 309], [237, 309],
      [231, 357], [218, 368], [111, 369], [98, 338], [88, 221], [63, 206],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9791, outlinePrecision: 0.9985 },
  ),
  bird: animalGeometry(
    { width: 600, height: 447 },
    58 * 55,
    { minX: 53, minY: 24, maxX: 579, maxY: 428 },
    [
      [53, 193], [76, 158], [143, 197], [209, 185], [246, 153], [306, 57], [387, 24], [474, 44],
      [525, 114], [568, 130], [579, 146], [529, 192], [526, 257], [502, 313], [459, 357], [415, 380],
      [439, 401], [424, 428], [355, 427], [343, 415], [345, 392], [326, 392], [330, 414], [318, 427],
      [243, 426], [236, 386], [160, 358], [94, 303], [62, 247],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9764, outlinePrecision: 0.9962 },
  ),
  cat: animalGeometry(
    { width: 600, height: 415 },
    72 * 74,
    { minX: 76, minY: 1, maxX: 599, maxY: 405 },
    [
      [76, 108], [109, 30], [140, 7], [179, 1], [212, 18], [220, 51], [207, 69], [171, 80],
      [154, 104], [151, 133], [166, 164], [213, 152], [365, 152], [420, 14], [444, 15], [477, 52],
      [528, 20], [544, 43], [546, 92], [599, 162], [569, 223], [508, 248], [489, 302], [493, 347],
      [512, 370], [502, 399], [395, 400], [370, 326], [256, 327], [246, 354], [259, 382], [249, 400],
      [136, 405], [106, 379], [117, 216], [86, 171],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9738, outlinePrecision: 0.9923 },
  ),
  fox: animalGeometry(
    { width: 600, height: 434 },
    92 * 68,
    { minX: 1, minY: 5, maxX: 597, maxY: 413 },
    [
      [1, 158], [20, 97], [49, 63], [95, 39], [142, 35], [187, 49], [217, 79], [215, 94],
      [185, 107], [169, 133], [174, 174], [194, 198], [387, 202], [373, 157], [395, 113], [403, 34],
      [425, 5], [469, 51], [495, 25], [512, 24], [521, 87], [559, 132], [597, 151], [576, 199],
      [505, 229], [509, 260], [479, 320], [506, 400], [436, 413], [382, 402], [361, 333], [267, 333],
      [251, 358], [266, 386], [257, 408], [139, 409], [128, 363], [153, 282], [91, 286], [42, 263],
      [10, 217],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9757, outlinePrecision: 0.9857 },
  ),
  hedgehog: animalGeometry(
    { width: 600, height: 409 },
    82 * 58,
    { minX: 40, minY: 1, maxX: 561, maxY: 387 },
    [
      [40, 214], [86, 169], [66, 150], [68, 133], [124, 106], [119, 71], [181, 59], [177, 33],
      [188, 22], [259, 33], [273, 1], [342, 33], [366, 11], [412, 57], [437, 49], [461, 101],
      [490, 101], [490, 146], [517, 191], [561, 210], [531, 271], [454, 309], [467, 374], [388, 387],
      [346, 386], [330, 370], [133, 384], [123, 372], [127, 346], [76, 338], [86, 300], [47, 290],
      [47, 268], [69, 238], [47, 232],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9722, outlinePrecision: 0.9967 },
  ),
  rabbit: animalGeometry(
    { width: 557, height: 600 },
    68 * 90,
    { minX: 48, minY: 2, maxX: 478, maxY: 575 },
    [
      [48, 497], [68, 459], [98, 450], [106, 407], [131, 365], [202, 320], [224, 247], [175, 180],
      [150, 106], [153, 42], [187, 5], [225, 4], [263, 34], [296, 8], [340, 21], [373, 102],
      [363, 200], [428, 232], [478, 300], [463, 368], [400, 421], [404, 504], [437, 535], [421, 574],
      [153, 575], [121, 550], [70, 549],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9738, outlinePrecision: 0.9993 },
  ),
  raccoon: animalGeometry(
    { width: 600, height: 402 },
    86 * 70,
    { minX: 1, minY: 2, maxX: 599, maxY: 377 },
    [
      [1, 151], [31, 92], [65, 76], [102, 77], [139, 106], [149, 175], [171, 203], [188, 168],
      [226, 138], [269, 127], [332, 131], [355, 95], [352, 30], [380, 2], [418, 11], [444, 39],
      [480, 38], [517, 6], [549, 5], [565, 39], [557, 85], [599, 143], [590, 175], [557, 210],
      [476, 237], [458, 290], [491, 361], [433, 377], [367, 375], [339, 312], [279, 314], [278, 331],
      [299, 353], [290, 369], [194, 375], [176, 342], [181, 289], [118, 294], [59, 267], [17, 218],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9744, outlinePrecision: 0.9936 },
  ),
  turtle: animalGeometry(
    { width: 600, height: 335 },
    94 * 52,
    { minX: 0, minY: 1, maxX: 600, maxY: 334 },
    [
      [0, 226], [13, 207], [52, 197], [69, 129], [124, 52], [175, 19], [231, 3], [294, 2],
      [352, 17], [399, 47], [428, 85], [473, 59], [526, 62], [554, 82], [600, 149], [592, 191],
      [564, 226], [483, 263], [496, 318], [445, 334], [364, 333], [350, 322], [344, 289], [198, 295],
      [185, 326], [70, 333], [51, 311], [54, 268], [13, 255],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9811, outlinePrecision: 0.9978 },
  ),
};

export const ANIMAL_CATALOG: Readonly<Record<AnimalId, AnimalDefinition>> = {
  bear: {
    id: 'bear',
    name: 'Bear',
    nameZh: '小熊',
    assetKey: 'animal-bear',
    texturePath: '/assets/game/animals/bear.webp',
    ...GEOMETRY.bear,
    physics: { density: 0.00145, friction: 0.72, frictionStatic: 0.88, restitution: 0.025, frictionAir: 0.012 },
    allowedAngles: ANGLES_30,
  },
  bird: {
    id: 'bird',
    name: 'Bird',
    nameZh: '小鸟',
    assetKey: 'animal-bird',
    texturePath: '/assets/game/animals/bird.webp',
    ...GEOMETRY.bird,
    physics: { density: 0.00105, friction: 0.63, frictionStatic: 0.8, restitution: 0.055, frictionAir: 0.015 },
    allowedAngles: ANGLES_45,
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    nameZh: '小猫',
    assetKey: 'animal-cat',
    texturePath: '/assets/game/animals/cat.webp',
    ...GEOMETRY.cat,
    physics: { density: 0.00115, friction: 0.7, frictionStatic: 0.86, restitution: 0.04, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
  },
  fox: {
    id: 'fox',
    name: 'Fox',
    nameZh: '小狐狸',
    assetKey: 'animal-fox',
    texturePath: '/assets/game/animals/fox.webp',
    ...GEOMETRY.fox,
    physics: { density: 0.00118, friction: 0.68, frictionStatic: 0.84, restitution: 0.045, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
  },
  hedgehog: {
    id: 'hedgehog',
    name: 'Hedgehog',
    nameZh: '小刺猬',
    assetKey: 'animal-hedgehog',
    texturePath: '/assets/game/animals/hedgehog.webp',
    ...GEOMETRY.hedgehog,
    physics: { density: 0.00125, friction: 0.79, frictionStatic: 0.92, restitution: 0.02, frictionAir: 0.014 },
    allowedAngles: ANGLES_45,
  },
  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    nameZh: '小兔',
    assetKey: 'animal-rabbit',
    texturePath: '/assets/game/animals/rabbit.webp',
    ...GEOMETRY.rabbit,
    physics: { density: 0.0011, friction: 0.71, frictionStatic: 0.87, restitution: 0.04, frictionAir: 0.014 },
    allowedAngles: ANGLES_30,
  },
  raccoon: {
    id: 'raccoon',
    name: 'Raccoon',
    nameZh: '小浣熊',
    assetKey: 'animal-raccoon',
    texturePath: '/assets/game/animals/raccoon.webp',
    ...GEOMETRY.raccoon,
    physics: { density: 0.00122, friction: 0.74, frictionStatic: 0.89, restitution: 0.035, frictionAir: 0.013 },
    allowedAngles: ANGLES_30,
  },
  turtle: {
    id: 'turtle',
    name: 'Turtle',
    nameZh: '小龟',
    assetKey: 'animal-turtle',
    texturePath: '/assets/game/animals/turtle.webp',
    ...GEOMETRY.turtle,
    physics: { density: 0.00135, friction: 0.82, frictionStatic: 0.95, restitution: 0.018, frictionAir: 0.012 },
    allowedAngles: ANGLES_45,
  },
};

export const ANIMALS: readonly AnimalDefinition[] = ANIMAL_IDS.map((id) => ANIMAL_CATALOG[id]);

export function getAnimalDefinition(id: AnimalId): AnimalDefinition {
  return ANIMAL_CATALOG[id];
}
