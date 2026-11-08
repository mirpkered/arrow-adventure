export type SoundEffect = 'blocked' | 'clear' | 'level';

/** Optional original Web Audio tones. Nothing starts until the player opts in and interacts. */
export class GameAudio {
  private context: AudioContext | undefined;
  private musicEnabled = false;
  private effectsEnabled = true;
  private musicTimer: number | undefined;
  private noteIndex = 0;
  private activeNotes = new Set<OscillatorNode>();

  private getContext(): AudioContext | undefined {
    if (this.context) return this.context;
    const Constructor = window.AudioContext;
    if (!Constructor) return undefined;
    try { this.context = new Constructor(); return this.context; } catch { return undefined; }
  }

  setPreferences(music: boolean, effects: boolean): void {
    this.musicEnabled = music;
    this.effectsEnabled = effects;
    if (music) this.startMusic();
    else this.stopMusic();
  }

  activate(): void {
    if (!this.musicEnabled) return;
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().then(() => this.startMusic());
    else this.startMusic();
  }

  private startMusic(): void {
    if (!this.musicEnabled || this.musicTimer !== undefined) return;
    const context = this.getContext();
    if (!context || context.state === 'suspended') return;
    const notes = [196, 246.94, 293.66, 392, 329.63, 246.94, 220, 293.66];
    const playNote = () => {
      if (!this.musicEnabled || !this.context) { this.musicTimer = undefined; return; }
      const at = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = notes[this.noteIndex % notes.length];
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.014, at + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(at); oscillator.stop(at + 0.68);
      this.activeNotes.add(oscillator);
      oscillator.onended = () => { this.activeNotes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      this.noteIndex += 1;
      this.musicTimer = window.setTimeout(playNote, 620);
    };
    playNote();
  }

  private stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearTimeout(this.musicTimer);
    this.musicTimer = undefined;
    for (const oscillator of this.activeNotes) { try { oscillator.stop(); } catch { /* Already stopped. */ } }
    this.activeNotes.clear();
  }

  play(effect: SoundEffect): void {
    if (!this.effectsEnabled) return;
    const context = this.getContext();
    if (!context || context.state === 'suspended') return;
    const tones: Record<SoundEffect, number[]> = { blocked: [260, 196], clear: [523.25, 659.25], level: [392, 523.25, 659.25] };
    const frequencies = tones[effect];
    const now = context.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.075;
      oscillator.type = effect === 'blocked' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(effect === 'blocked' ? 0.04 : 0.035, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + 0.13);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
