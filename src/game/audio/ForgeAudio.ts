export class ForgeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private crackleTimer: number | null = null;
  private hammerTimer: number | null = null;
  private active = false;
  private unlocked = false;

  constructor() {
    window.addEventListener("pointerdown", () => void this.unlock(), { once: true });
    window.addEventListener("keydown", () => void this.unlock(), { once: true });
  }

  setMenuActive(active: boolean): void {
    this.active = active;
    if (!this.unlocked) {
      return;
    }

    if (active) {
      void this.start();
    } else {
      this.stop();
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      return;
    }
    const context = this.getContext();
    await context.resume();
    this.unlocked = true;
    if (this.active) {
      void this.start();
    }
  }

  private async start(): Promise<void> {
    const context = this.getContext();
    await context.resume();
    if (this.ambience) {
      return;
    }

    this.master = context.createGain();
    this.master.gain.setValueAtTime(0.22, context.currentTime);
    this.master.connect(context.destination);

    this.ambienceGain = context.createGain();
    this.ambienceGain.gain.setValueAtTime(0.06, context.currentTime);
    this.ambienceGain.connect(this.master);

    this.ambience = context.createOscillator();
    this.ambience.type = "sawtooth";
    this.ambience.frequency.setValueAtTime(58, context.currentTime);
    this.ambience.connect(this.ambienceGain);
    this.ambience.start();

    this.scheduleCrackle();
    this.scheduleHammer();
  }

  private stop(): void {
    if (this.crackleTimer !== null) {
      window.clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (this.hammerTimer !== null) {
      window.clearTimeout(this.hammerTimer);
      this.hammerTimer = null;
    }

    const context = this.context;
    if (!context) {
      return;
    }

    if (this.ambienceGain) {
      this.ambienceGain.gain.cancelScheduledValues(context.currentTime);
      this.ambienceGain.gain.setTargetAtTime(0, context.currentTime, 0.08);
    }
    if (this.master) {
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setTargetAtTime(0, context.currentTime, 0.08);
    }

    const ambience = this.ambience;
    const master = this.master;
    window.setTimeout(() => {
      ambience?.stop();
      ambience?.disconnect();
      master?.disconnect();
    }, 180);

    this.ambience = null;
    this.ambienceGain = null;
    this.master = null;
  }

  private scheduleCrackle(): void {
    if (!this.active || !this.context || !this.master) {
      return;
    }
    this.playCrackle();
    this.crackleTimer = window.setTimeout(() => this.scheduleCrackle(), 90 + Math.random() * 180);
  }

  private scheduleHammer(): void {
    if (!this.active || !this.context || !this.master) {
      return;
    }
    this.playHammerStrike();
    this.hammerTimer = window.setTimeout(() => this.scheduleHammer(), 1350 + Math.random() * 1700);
  }

  private playCrackle(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const duration = 0.035 + Math.random() * 0.06;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.018 + Math.random() * 0.028, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(context.currentTime + duration);
  }

  private playHammerStrike(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const now = context.currentTime;
    this.playTone(880 + Math.random() * 120, now, 0.15, 0.12);
    this.playTone(1320 + Math.random() * 160, now + 0.012, 0.09, 0.06);
    this.playTone(190 + Math.random() * 28, now, 0.22, 0.08);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(1.4, now);

    const duration = 0.18;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration);
  }

  private playTone(frequency: number, start: number, duration: number, volume: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.82), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }
}
