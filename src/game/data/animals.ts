import { ANIMAL_IDS, type AnimalId, type GameLanguage } from '../core/types';
import {
  createCollisionGeometry,
  createPhysicsCollisionShape,
  displaySizeForWidth,
  type CollisionFit,
  type CollisionGeometry,
  type CollisionShape,
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

export type AnimalRole = 'foundation' | 'bridge' | 'filler' | 'balancer' | 'challenge';

export interface AnimalGameplayProfile {
  readonly role: AnimalRole;
  /** Short, player-facing advice shown while aiming this animal. */
  readonly tip: string;
  readonly tipEn: string;
  /** Feedback shown after the animal reaches a stable resting state. */
  readonly settledCopy: string;
  readonly settledCopyEn: string;
  /** Keyboard handling only; pointer placement remains direct. */
  readonly moveSpeedMultiplier: number;
  /** Safe postures that this animal's AI strategy should favor. Degrees. */
  readonly preferredAngles: readonly number[];
  readonly aiOrientationWeight: number;
}

export interface AnimalDefinition {
  readonly id: AnimalId;
  readonly name: string;
  readonly nameZh: string;
  readonly sizeLabel: string;
  readonly sizeLabelEn: string;
  readonly trait: string;
  readonly traitEn: string;
  readonly assetKey: `animal-${AnimalId}`;
  readonly texturePath: `/assets/game/animals/${AnimalId}.webp`;
  /** The encoded WebP canvas, before Phaser display scaling. */
  readonly sourceSize: Size;
  /** One-axis render scale used for both axes to prevent sprite distortion. */
  readonly displayScale: number;
  /** Logical display size; derived from displayScale on both axes. */
  readonly display: Size;
  readonly physics: {
    readonly density: number;
    readonly friction: number;
    readonly frictionStatic: number;
    readonly restitution: number;
    readonly frictionAir: number;
  };
  readonly gameplay: AnimalGameplayProfile;
  /** Discrete target angles used by the AI; player rotation is continuous. */
  readonly allowedAngles: readonly number[];
  /** Alpha-derived, renderer-independent collision geometry. */
  readonly collision: CollisionGeometry;
  /** Optional simplified Matter shape for silhouettes prone to contact jitter. */
  readonly physicsCollision?: CollisionShape;
}

const ANGLES_30 = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180] as const;
const ANGLES_45 = [-135, -90, -45, 0, 45, 90, 135, 180] as const;

function animalGeometry(
  sourceSize: Size,
  targetWidth: number,
  sourceAlphaBounds: RectBounds,
  sourceOutline: readonly PixelVertex[],
  fit: CollisionFit,
): Pick<AnimalDefinition, 'sourceSize' | 'displayScale' | 'display' | 'collision'> {
  const displayScale = targetWidth / sourceSize.width;
  const display = displaySizeForWidth(sourceSize, targetWidth);
  return {
    sourceSize,
    displayScale,
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
 * Outlines were traced from alpha >= 48 and simplified to bounded 20–45 point
 * polygons, using 8px source-space tolerance where the fit gates allow it and
 * fit-aware refinement for intricate silhouettes. Coordinates below are source
 * pixel-edge coordinates; the helper scales them into displayed-texture space.
 */
const GEOMETRY: Readonly<Record<
  AnimalId,
  Pick<AnimalDefinition, 'sourceSize' | 'displayScale' | 'display' | 'collision'>
>> = {
  bear: animalGeometry(
    { width: 600, height: 397 },
    148,
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
    56,
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
    88,
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
  crocodile: animalGeometry(
    { width: 600, height: 175 },
    196,
    { minX: 0, minY: 0, maxX: 600, maxY: 175 },
    [
      [467, 0], [497, 7], [515, 35], [549, 37], [565, 24], [582, 23], [600, 44], [597, 65],
      [571, 93], [528, 105], [485, 104], [458, 129], [477, 159], [469, 174], [367, 175],
      [357, 153], [270, 150], [269, 174], [206, 175], [197, 149], [112, 148], [52, 128],
      [19, 102], [0, 70], [9, 55], [31, 71], [71, 76], [80, 90], [92, 81], [121, 81],
      [141, 89], [151, 74], [172, 81], [185, 62], [205, 70], [216, 52], [302, 34], [319, 47],
      [341, 32], [357, 48], [373, 35], [392, 48], [418, 19], [440, 22], [451, 7],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9751, outlinePrecision: 0.9868 },
  ),
  elephant: animalGeometry(
    { width: 600, height: 364 },
    166,
    { minX: 0, minY: 0, maxX: 600, maxY: 364 },
    [
      [296, 0], [337, 5], [369, 27], [423, 16], [476, 37], [504, 75], [546, 224], [564, 234],
      [574, 220], [592, 220], [593, 261], [567, 282], [527, 284], [442, 224], [399, 235],
      [412, 299], [432, 326], [422, 351], [274, 361], [259, 345], [262, 287], [222, 289],
      [234, 326], [226, 351], [148, 364], [83, 359], [75, 332], [96, 256], [80, 195],
      [47, 242], [11, 242], [0, 226], [24, 189], [56, 181], [122, 103], [162, 83], [219, 76],
      [254, 19],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9789, outlinePrecision: 0.9916 },
  ),
  fox: animalGeometry(
    { width: 600, height: 434 },
    122,
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
  frog: animalGeometry(
    { width: 600, height: 477 },
    68,
    { minX: 0, minY: 0, maxX: 600, maxY: 477 },
    [
      [402, 0], [481, 21], [521, 89], [578, 116], [600, 159], [593, 204], [560, 254],
      [513, 291], [457, 314], [434, 379], [483, 420], [485, 463], [311, 477], [278, 448],
      [243, 452], [222, 472], [75, 470], [25, 452], [4, 422], [0, 379], [69, 231], [154, 169],
      [257, 149], [298, 105], [329, 36],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9762, outlinePrecision: 0.9984 },
  ),
  giraffe: animalGeometry(
    { width: 331, height: 608 },
    96,
    { minX: 0, minY: 0, maxX: 331, maxY: 605 },
    [
      [218, 0], [283, 18], [284, 37], [271, 53], [331, 115], [311, 158], [251, 160],
      [265, 370], [247, 494], [258, 597], [206, 605], [178, 594], [175, 476], [158, 470], [134, 512],
      [149, 593], [87, 605], [58, 593], [54, 574], [56, 513], [70, 479], [63, 443], [54, 476],
      [25, 492], [0, 485], [16, 437], [40, 430], [54, 400], [90, 367], [157, 336], [152, 314],
      [165, 295], [158, 269], [169, 254], [161, 229], [172, 211], [164, 184], [174, 170],
      [166, 150], [183, 93], [161, 68], [159, 42], [182, 28], [215, 49], [202, 17],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9724, outlinePrecision: 0.9825 },
  ),
  hedgehog: animalGeometry(
    { width: 600, height: 409 },
    76,
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
  mouse: animalGeometry(
    { width: 600, height: 395 },
    60,
    { minX: 32, minY: 1, maxX: 558, maxY: 373 },
    [
      [121, 7], [146, 28], [160, 59], [153, 117], [85, 197], [90, 222], [113, 239], [157, 238],
      [183, 196], [237, 163], [314, 165], [280, 122], [276, 72], [302, 29], [344, 9], [388, 13],
      [430, 54], [472, 42], [501, 56], [516, 86], [505, 133], [526, 169], [554, 181], [558, 202],
      [514, 250], [449, 267], [414, 326], [444, 346], [436, 373], [375, 371], [349, 341], [297, 348],
      [287, 373], [176, 373], [158, 350], [161, 297], [75, 283], [46, 259], [32, 225], [42, 167],
      [110, 89], [100, 50], [46, 30], [51, 10], [70, 1],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9746, outlinePrecision: 0.9859 },
  ),
  penguin: animalGeometry(
    { width: 427, height: 600 },
    68,
    { minX: 0, minY: 0, maxX: 427, maxY: 600 },
    [
      [211, 0], [268, 4], [322, 31], [356, 71], [377, 136], [426, 167], [423, 192],
      [376, 220], [362, 247], [387, 357], [385, 425], [360, 490], [315, 534], [337, 561],
      [323, 592], [94, 599], [66, 577], [74, 539], [29, 502], [5, 451], [11, 299], [52, 148],
      [91, 71], [147, 20],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9841, outlinePrecision: 0.9975 },
  ),
  rabbit: animalGeometry(
    { width: 557, height: 600 },
    76,
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
    108,
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
  tiger: animalGeometry(
    { width: 600, height: 385 },
    132,
    { minX: 35, minY: 1, maxX: 599, maxY: 382 },
    [
      [199, 6], [217, 42], [200, 61], [140, 67], [107, 89], [97, 137], [120, 158], [199, 128],
      [360, 124], [392, 68], [395, 27], [415, 7], [443, 4], [476, 32], [496, 16], [518, 21],
      [571, 112], [599, 140], [578, 190], [507, 219], [489, 254], [494, 320], [522, 352], [515, 374],
      [384, 382], [368, 368], [353, 308], [267, 304], [254, 323], [278, 356], [261, 379], [198, 375],
      [180, 316], [164, 328], [180, 357], [167, 380], [92, 374], [88, 317], [117, 225], [59, 194],
      [38, 156], [35, 112], [68, 42], [115, 11], [153, 1],
    ],
    { alphaThreshold: 48, opaqueCoverage: 0.9768, outlinePrecision: 0.9859 },
  ),
  turtle: animalGeometry(
    { width: 600, height: 335 },
    104,
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
    sizeLabel: '巨型',
    sizeLabelEn: 'Giant',
    trait: '稳重大块',
    traitEn: 'Heavy Anchor',
    assetKey: 'animal-bear',
    texturePath: '/assets/game/animals/bear.webp',
    ...GEOMETRY.bear,
    physics: { density: 0.00145, friction: 0.72, frictionStatic: 0.88, restitution: 0.006, frictionAir: 0.022 },
    gameplay: {
      role: 'foundation',
      tip: '身体宽厚，适合压住晃动的下层',
      tipEn: 'Its broad body can pin down a wobbly lower layer.',
      settledCopy: '厚实身体稳稳压住了下层',
      settledCopyEn: 'Its solid body steadied the layer below.',
      moveSpeedMultiplier: 0.82,
      preferredAngles: [0],
      aiOrientationWeight: 0.9,
    },
    allowedAngles: ANGLES_30,
  },
  bird: {
    id: 'bird',
    name: 'Bird',
    nameZh: '小鸟',
    sizeLabel: '迷你',
    sizeLabelEn: 'Mini',
    trait: '迷你填缝',
    traitEn: 'Tiny Filler',
    assetKey: 'animal-bird',
    texturePath: '/assets/game/animals/bird.webp',
    ...GEOMETRY.bird,
    physics: { density: 0.00105, friction: 0.63, frictionStatic: 0.8, restitution: 0.012, frictionAir: 0.028 },
    gameplay: {
      role: 'filler',
      tip: '身体最小，适合补上窄小缺口',
      tipEn: 'The smallest animal, perfect for narrow gaps.',
      settledCopy: '小身材补上了细小缺口',
      settledCopyEn: 'Its tiny body filled a narrow gap.',
      moveSpeedMultiplier: 1.18,
      preferredAngles: [0],
      aiOrientationWeight: 0.55,
    },
    allowedAngles: ANGLES_45,
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    nameZh: '小猫',
    sizeLabel: '中型',
    sizeLabelEn: 'Medium',
    trait: '灵巧平衡',
    traitEn: 'Agile Balance',
    assetKey: 'animal-cat',
    texturePath: '/assets/game/animals/cat.webp',
    ...GEOMETRY.cat,
    physics: { density: 0.00115, friction: 0.7, frictionStatic: 0.86, restitution: 0.008, frictionAir: 0.024 },
    gameplay: {
      role: 'balancer',
      tip: '体型适中，适合衔接宽窄不同的层',
      tipEn: 'Its medium build connects wide and narrow layers well.',
      settledCopy: '灵巧地接住了塔的重心',
      settledCopyEn: 'It nimbly caught the tower\'s center of gravity.',
      moveSpeedMultiplier: 1.05,
      preferredAngles: [-30, 0, 30],
      aiOrientationWeight: 0.5,
    },
    allowedAngles: ANGLES_30,
  },
  crocodile: {
    id: 'crocodile',
    name: 'Crocodile',
    nameZh: '鳄鱼',
    sizeLabel: '超长',
    sizeLabelEn: 'Extra Long',
    trait: '超长桥梁',
    traitEn: 'Long Bridge',
    assetKey: 'animal-crocodile',
    texturePath: '/assets/game/animals/crocodile.webp',
    ...GEOMETRY.crocodile,
    physics: { density: 0.00132, friction: 0.8, frictionStatic: 0.94, restitution: 0.004, frictionAir: 0.022 },
    gameplay: {
      role: 'bridge',
      tip: '横放能跨越两个支点，竖放风险很高',
      tipEn: 'Lay it flat to bridge two supports; upright is risky.',
      settledCopy: '长身体搭成了一道横桥',
      settledCopyEn: 'Its long body formed a bridge.',
      moveSpeedMultiplier: 0.74,
      preferredAngles: [0],
      aiOrientationWeight: 1.15,
    },
    allowedAngles: ANGLES_30,
  },
  elephant: {
    id: 'elephant',
    name: 'Elephant',
    nameZh: '大象',
    sizeLabel: '巨型',
    sizeLabelEn: 'Giant',
    trait: '重型底座',
    traitEn: 'Heavy Base',
    assetKey: 'animal-elephant',
    texturePath: '/assets/game/animals/elephant.webp',
    ...GEOMETRY.elephant,
    physics: { density: 0.00155, friction: 0.76, frictionStatic: 0.91, restitution: 0.004, frictionAir: 0.022 },
    gameplay: {
      role: 'foundation',
      tip: '重量最大，尽量靠近平台或塔的中心',
      tipEn: 'The heaviest animal; keep it near the platform or tower center.',
      settledCopy: '重量把下层压得更稳了',
      settledCopyEn: 'Its weight made the lower layer more stable.',
      moveSpeedMultiplier: 0.68,
      preferredAngles: [0],
      aiOrientationWeight: 1.05,
    },
    allowedAngles: ANGLES_30,
  },
  fox: {
    id: 'fox',
    name: 'Fox',
    nameZh: '小狐狸',
    sizeLabel: '大型',
    sizeLabelEn: 'Large',
    trait: '长尾支点',
    traitEn: 'Tail Support',
    assetKey: 'animal-fox',
    texturePath: '/assets/game/animals/fox.webp',
    ...GEOMETRY.fox,
    physics: { density: 0.00118, friction: 0.68, frictionStatic: 0.84, restitution: 0.008, frictionAir: 0.024 },
    gameplay: {
      role: 'balancer',
      tip: '长尾能当支点，轻微倾斜更容易找平',
      tipEn: 'Its long tail can support it; a slight tilt helps it level out.',
      settledCopy: '长尾找到了新的支点',
      settledCopyEn: 'Its long tail found a new support point.',
      moveSpeedMultiplier: 0.96,
      preferredAngles: [-30, 0, 30],
      aiOrientationWeight: 0.65,
    },
    allowedAngles: ANGLES_30,
  },
  frog: {
    id: 'frog',
    name: 'Frog',
    nameZh: '青蛙',
    sizeLabel: '迷你',
    sizeLabelEn: 'Mini',
    trait: '小巧填缝',
    traitEn: 'Pocket Filler',
    assetKey: 'animal-frog',
    texturePath: '/assets/game/animals/frog.webp',
    ...GEOMETRY.frog,
    physics: { density: 0.001, friction: 0.76, frictionStatic: 0.89, restitution: 0.01, frictionAir: 0.028 },
    gameplay: {
      role: 'filler',
      tip: '贴进凹槽，可以填平不规则的表面',
      tipEn: 'Tuck it into a groove to level an uneven surface.',
      settledCopy: '小身体牢牢卡进了缝隙',
      settledCopyEn: 'Its little body wedged firmly into the gap.',
      moveSpeedMultiplier: 1.2,
      preferredAngles: [0],
      aiOrientationWeight: 0.65,
    },
    allowedAngles: ANGLES_45,
  },
  giraffe: {
    id: 'giraffe',
    name: 'Giraffe',
    nameZh: '长颈鹿',
    sizeLabel: '高型',
    sizeLabelEn: 'Tall',
    trait: '高而难稳',
    traitEn: 'Tall Challenge',
    assetKey: 'animal-giraffe',
    texturePath: '/assets/game/animals/giraffe.webp',
    ...GEOMETRY.giraffe,
    physics: { density: 0.0011, friction: 0.72, frictionStatic: 0.88, restitution: 0.006, frictionAir: 0.026 },
    gameplay: {
      role: 'challenge',
      tip: '竖放冲高度，横放更容易稳定',
      tipEn: 'Stand it up for height, or lay it sideways for safety.',
      settledCopy: '高挑身体惊险地站稳了',
      settledCopyEn: 'Its tall body found a precarious balance.',
      moveSpeedMultiplier: 0.72,
      preferredAngles: [-90, 90],
      aiOrientationWeight: 1.1,
    },
    allowedAngles: ANGLES_30,
  },
  hedgehog: {
    id: 'hedgehog',
    name: 'Hedgehog',
    nameZh: '小刺猬',
    sizeLabel: '小型',
    sizeLabelEn: 'Small',
    trait: '尖背抓地',
    traitEn: 'Spiny Grip',
    assetKey: 'animal-hedgehog',
    texturePath: '/assets/game/animals/hedgehog.webp',
    ...GEOMETRY.hedgehog,
    physics: { density: 0.00125, friction: 0.79, frictionStatic: 0.92, restitution: 0.005, frictionAir: 0.026 },
    gameplay: {
      role: 'filler',
      tip: '尖背能卡住上层，也适合塞入浅凹槽',
      tipEn: 'Its spiny back grips upper layers and shallow grooves.',
      settledCopy: '尖背把接触点卡牢了',
      settledCopyEn: 'Its spines locked the contact point in place.',
      moveSpeedMultiplier: 1.08,
      preferredAngles: [0],
      aiOrientationWeight: 0.7,
    },
    allowedAngles: ANGLES_45,
  },
  mouse: {
    id: 'mouse',
    name: 'Mouse',
    nameZh: '小鼠',
    sizeLabel: '迷你',
    sizeLabelEn: 'Mini',
    trait: '长尾填缝',
    traitEn: 'Tail Filler',
    assetKey: 'animal-mouse',
    texturePath: '/assets/game/animals/mouse.webp',
    ...GEOMETRY.mouse,
    physics: { density: 0.001, friction: 0.68, frictionStatic: 0.84, restitution: 0.01, frictionAir: 0.028 },
    gameplay: {
      role: 'filler',
      tip: '身体很小，长尾能勾住边缘或补上窄缝',
      tipEn: 'Its tiny body fills narrow gaps while the long tail can catch an edge.',
      settledCopy: '长尾勾住边缘，小身体填平了缝隙',
      settledCopyEn: 'Its long tail caught the edge while its tiny body filled the gap.',
      moveSpeedMultiplier: 1.2,
      preferredAngles: [0],
      aiOrientationWeight: 0.65,
    },
    allowedAngles: ANGLES_45,
  },
  penguin: {
    id: 'penguin',
    name: 'Penguin',
    nameZh: '企鹅',
    sizeLabel: '高型',
    sizeLabelEn: 'Tall',
    trait: '圆滚摇摆',
    traitEn: 'Round Wobbler',
    assetKey: 'animal-penguin',
    texturePath: '/assets/game/animals/penguin.webp',
    ...GEOMETRY.penguin,
    physics: { density: 0.00118, friction: 0.55, frictionStatic: 0.73, restitution: 0.01, frictionAir: 0.026 },
    gameplay: {
      role: 'challenge',
      tip: '圆肚容易滚，优先寻找 V 形凹槽',
      tipEn: 'Its round belly rolls easily, so look for a V-shaped groove.',
      settledCopy: '圆肚晃了几下终于停稳',
      settledCopyEn: 'Its round belly wobbled, then finally settled.',
      moveSpeedMultiplier: 1,
      preferredAngles: [-90, 90],
      aiOrientationWeight: 0.9,
    },
    allowedAngles: ANGLES_45,
  },
  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    nameZh: '小兔',
    sizeLabel: '小型',
    sizeLabelEn: 'Small',
    trait: '直立挑战',
    traitEn: 'Upright Challenge',
    assetKey: 'animal-rabbit',
    texturePath: '/assets/game/animals/rabbit.webp',
    ...GEOMETRY.rabbit,
    // The detailed silhouette decomposes into six small Matter parts whose
    // competing flat-ground contacts keep waking one another. This two-lobe
    // proxy preserves the visible bounds while giving the feet one stable base.
    physicsCollision: createPhysicsCollisionShape(
      GEOMETRY.rabbit.sourceSize,
      GEOMETRY.rabbit.display,
      [
        [202, 320], [150, 106], [153, 42], [187, 5], [225, 4], [296, 8], [340, 21],
        [478, 300], [463, 368], [400, 421], [437, 535], [421, 574], [153, 575],
        [70, 549], [48, 497], [68, 459], [131, 365],
      ],
    ),
    physics: { density: 0.0011, friction: 0.5, frictionStatic: 0.7, restitution: 0.008, frictionAir: 0.05 },
    gameplay: {
      role: 'challenge',
      tip: '直立能快速增高，横放会更安全',
      tipEn: 'Stand it up for quick height, or lay it sideways for safety.',
      settledCopy: '直立身体保持住了平衡',
      settledCopyEn: 'Its upright body held the balance.',
      moveSpeedMultiplier: 1.04,
      preferredAngles: [-90, 90],
      aiOrientationWeight: 0.85,
    },
    allowedAngles: ANGLES_30,
  },
  raccoon: {
    id: 'raccoon',
    name: 'Raccoon',
    nameZh: '小浣熊',
    sizeLabel: '中大型',
    sizeLabelEn: 'Medium Large',
    trait: '尾巴配重',
    traitEn: 'Tail Counterweight',
    assetKey: 'animal-raccoon',
    texturePath: '/assets/game/animals/raccoon.webp',
    ...GEOMETRY.raccoon,
    physics: { density: 0.00122, friction: 0.74, frictionStatic: 0.89, restitution: 0.007, frictionAir: 0.024 },
    gameplay: {
      role: 'balancer',
      tip: '尾巴能配重，稍微倾斜可修正重心',
      tipEn: 'Its tail is a counterweight; a slight tilt can correct its balance.',
      settledCopy: '尾巴帮它找回了重心',
      settledCopyEn: 'Its tail pulled the center of gravity back in line.',
      moveSpeedMultiplier: 0.92,
      preferredAngles: [-30, 0, 30],
      aiOrientationWeight: 0.65,
    },
    allowedAngles: ANGLES_30,
  },
  tiger: {
    id: 'tiger',
    name: 'Tiger',
    nameZh: '老虎',
    sizeLabel: '大型',
    sizeLabelEn: 'Large',
    trait: '虎尾支撑',
    traitEn: 'Tail Brace',
    assetKey: 'animal-tiger',
    texturePath: '/assets/game/animals/tiger.webp',
    ...GEOMETRY.tiger,
    physics: { density: 0.00128, friction: 0.71, frictionStatic: 0.87, restitution: 0.006, frictionAir: 0.024 },
    gameplay: {
      role: 'balancer',
      tip: '身体宽长，卷起的虎尾能成为额外支点',
      tipEn: 'Its broad body and curled tail can create an extra support point.',
      settledCopy: '卷起的虎尾帮身体撑住了重心',
      settledCopyEn: 'Its curled tail helped brace the center of gravity.',
      moveSpeedMultiplier: 0.9,
      preferredAngles: [-30, 0, 30],
      aiOrientationWeight: 0.72,
    },
    allowedAngles: ANGLES_30,
  },
  turtle: {
    id: 'turtle',
    name: 'Turtle',
    nameZh: '小龟',
    sizeLabel: '中大型',
    sizeLabelEn: 'Medium Large',
    trait: '低矮稳固',
    traitEn: 'Low and Steady',
    assetKey: 'animal-turtle',
    texturePath: '/assets/game/animals/turtle.webp',
    ...GEOMETRY.turtle,
    physics: { density: 0.00135, friction: 0.82, frictionStatic: 0.95, restitution: 0.004, frictionAir: 0.022 },
    gameplay: {
      role: 'foundation',
      tip: '低矮又防滑，适合铺出下一层平台',
      tipEn: 'Low and grippy, it can create a stable platform for the next layer.',
      settledCopy: '低矮龟壳铺平了一层',
      settledCopyEn: 'Its low shell leveled out a new layer.',
      moveSpeedMultiplier: 0.86,
      preferredAngles: [0],
      aiOrientationWeight: 1,
    },
    allowedAngles: ANGLES_45,
  },
};

export const ANIMALS: readonly AnimalDefinition[] = ANIMAL_IDS.map((id) => ANIMAL_CATALOG[id]);

export function getAnimalDefinition(id: AnimalId): AnimalDefinition {
  return ANIMAL_CATALOG[id];
}

export function getPhysicsCollision(definition: AnimalDefinition): CollisionShape {
  return definition.physicsCollision ?? definition.collision;
}

export interface LocalizedAnimalCopy {
  readonly name: string;
  readonly sizeLabel: string;
  readonly trait: string;
  readonly tip: string;
  readonly settledCopy: string;
}

export function getAnimalCopy(id: AnimalId, language: GameLanguage): LocalizedAnimalCopy {
  const animal = getAnimalDefinition(id);
  if (language === 'en') {
    return {
      name: animal.name,
      sizeLabel: animal.sizeLabelEn,
      trait: animal.traitEn,
      tip: animal.gameplay.tipEn,
      settledCopy: animal.gameplay.settledCopyEn,
    };
  }

  return {
    name: animal.nameZh,
    sizeLabel: animal.sizeLabel,
    trait: animal.trait,
    tip: animal.gameplay.tip,
    settledCopy: animal.gameplay.settledCopy,
  };
}
