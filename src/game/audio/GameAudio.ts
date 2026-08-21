type ToneName = 'move' | 'rotate' | 'drop' | 'settle' | 'win' | 'lose';

const TONES: Record<ToneName, readonly number[]> = {
  move: [330],
  rotate: [440, 520],
  drop: [220, 150],
  settle: [392, 494],
  win: [523, 659, 784],
  lose: [330, 247, 196],
};

/** Tiny synthesized sound layer so the game has feedback without stock audio. */
export class GameAudio {
  private context: AudioContext | null = null;

  unlock(): void {
    if (this.context === null) {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  play(name: ToneName): void {
    this.unlock();
    const context = this.context;
    if (context === null || context.state !== 'running') {
      return;
    }

    const now = context.currentTime;
    TONES[name].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.055;
      const duration = name === 'win' || name === 'lose' ? 0.14 : 0.075;

      oscillator.type = name === 'lose' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.92), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
  }

  destroy(): void {
    if (this.context !== null) {
      void this.context.close();
      this.context = null;
    }
  }
}
