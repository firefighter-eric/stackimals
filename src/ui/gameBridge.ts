export type AnimalId =
  | 'bear'
  | 'bird'
  | 'cat'
  | 'fox'
  | 'hedgehog'
  | 'rabbit'
  | 'raccoon'
  | 'turtle';

export type GameActor = 'human' | 'ai';

export type GamePhase =
  | 'loading'
  | 'humanAiming'
  | 'humanSettling'
  | 'aiThinking'
  | 'aiSettling'
  | 'paused'
  | 'gameOver'
  | 'error';

export interface AnimalPreview {
  id: AnimalId;
  name: string;
  assetUrl: string;
}

export interface GameSnapshot {
  phase: GamePhase;
  turn: GameActor;
  round: number;
  scoreHuman: number;
  scoreAi: number;
  message: string;
  currentAnimal: AnimalPreview;
  upcomingHuman: readonly AnimalPreview[];
  upcomingAi: readonly AnimalPreview[];
  winner: GameActor | null;
}

export type GameCommand =
  | { type: 'move'; direction: -1 | 1; active: boolean }
  | { type: 'rotate'; direction: -1 | 1 }
  | { type: 'drop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' };

export interface GameBridge {
  mount(
    container: HTMLElement,
    publishSnapshot: (snapshot: GameSnapshot) => void,
  ): () => void;
  dispatch(command: GameCommand): void;
}

export const ANIMALS: Record<AnimalId, AnimalPreview> = {
  bear: {
    id: 'bear',
    name: '小熊',
    assetUrl: '/assets/game/animals/bear.webp',
  },
  bird: {
    id: 'bird',
    name: '蓝鸟',
    assetUrl: '/assets/game/animals/bird.webp',
  },
  cat: {
    id: 'cat',
    name: '橘猫',
    assetUrl: '/assets/game/animals/cat.webp',
  },
  fox: {
    id: 'fox',
    name: '狐狸',
    assetUrl: '/assets/game/animals/fox.webp',
  },
  hedgehog: {
    id: 'hedgehog',
    name: '刺猬',
    assetUrl: '/assets/game/animals/hedgehog.webp',
  },
  rabbit: {
    id: 'rabbit',
    name: '兔子',
    assetUrl: '/assets/game/animals/rabbit.webp',
  },
  raccoon: {
    id: 'raccoon',
    name: '浣熊',
    assetUrl: '/assets/game/animals/raccoon.webp',
  },
  turtle: {
    id: 'turtle',
    name: '乌龟',
    assetUrl: '/assets/game/animals/turtle.webp',
  },
};

export const INITIAL_GAME_SNAPSHOT: GameSnapshot = {
  phase: 'loading',
  turn: 'human',
  round: 1,
  scoreHuman: 0,
  scoreAi: 0,
  message: '正在准备动物积木…',
  currentAnimal: ANIMALS.rabbit,
  upcomingHuman: [ANIMALS.hedgehog, ANIMALS.turtle, ANIMALS.bird],
  upcomingAi: [ANIMALS.cat, ANIMALS.raccoon, ANIMALS.rabbit],
  winner: null,
};
