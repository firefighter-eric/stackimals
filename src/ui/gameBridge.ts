import { ANIMAL_IDS, type AnimalId, type GameLanguage } from '../game/core/types';
import { ANIMAL_CATALOG, getAnimalCopy } from '../game/data/animals';

export type { AnimalId, GameLanguage };

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
  sizeLabel: string;
  trait: string;
  tip: string;
}

export interface GameSnapshot {
  language: GameLanguage;
  phase: GamePhase;
  turn: GameActor;
  round: number;
  scoreHuman: number;
  scoreAi: number;
  swapsHuman: number;
  swapsAi: number;
  message: string;
  currentAnimal: AnimalPreview;
  upcomingHuman: readonly AnimalPreview[];
  upcomingAi: readonly AnimalPreview[];
  winner: GameActor | null;
}

export type GameCommand =
  | { type: 'move'; direction: -1 | 1; active: boolean }
  | { type: 'rotate'; direction: -1 | 1; active: boolean }
  | { type: 'drop' }
  | { type: 'swap' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'setLanguage'; language: GameLanguage };

export interface GameBridge {
  mount(
    container: HTMLElement,
    publishSnapshot: (snapshot: GameSnapshot) => void,
  ): () => void;
  dispatch(command: GameCommand): void;
}

export function getAnimalPreview(id: AnimalId, language: GameLanguage): AnimalPreview {
  const animal = ANIMAL_CATALOG[id];
  const copy = getAnimalCopy(id, language);
  return {
    id,
    name: copy.name,
    assetUrl: animal.texturePath,
    sizeLabel: copy.sizeLabel,
    trait: copy.trait,
    tip: copy.tip,
  };
}

export const ANIMALS = Object.fromEntries(ANIMAL_IDS.map((id) => (
  [id, getAnimalPreview(id, 'zh')]
))) as Record<AnimalId, AnimalPreview>;

export function createInitialGameSnapshot(language: GameLanguage): GameSnapshot {
  return {
    language,
    phase: 'loading',
    turn: 'human',
    round: 1,
    scoreHuman: 0,
    scoreAi: 0,
    swapsHuman: 3,
    swapsAi: 3,
    message: '',
    currentAnimal: getAnimalPreview('rabbit', language),
    upcomingHuman: ['hedgehog', 'turtle', 'bird'].map((id) => getAnimalPreview(id as AnimalId, language)),
    upcomingAi: ['cat', 'raccoon', 'rabbit'].map((id) => getAnimalPreview(id as AnimalId, language)),
    winner: null,
  };
}

export const INITIAL_GAME_SNAPSHOT: GameSnapshot = createInitialGameSnapshot('zh');
