import type { AnimalId, StackBodySnapshot } from './core/types';
import type { GamePhase } from '../ui/gameBridge';

export interface TestSnapshot {
  readonly phase: GamePhase;
  readonly turn: 'human' | 'ai';
  readonly round: number;
  readonly winner: 'human' | 'ai' | null;
  readonly bodyCount: number;
  readonly currentAnimal: AnimalId;
  readonly swapsHuman: number;
  readonly swapsAi: number;
  readonly guideLinesEnabled: boolean;
  readonly previewAngle: number | null;
  readonly previewPosition: { readonly x: number; readonly y: number } | null;
  readonly bodies: readonly StackBodySnapshot[];
}
declare global {
  interface Window {
    __STACKIMALS_TEST__?: {
      snapshot(): TestSnapshot;
      restart(): void;
      swap(): void;
      place(x: number, angle?: number): void;
      resolveAiImmediately(): void;
      forceFall(bodyId: string): void;
    };
  }
}
