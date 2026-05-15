import type { ActionState, ImpactEffect, PlayerId, WeaponType } from "../types";

const BASE_MASTER_GAIN = 0.68;
const DEFAULT_VOLUME_PERCENT = 50;
const VOLUME_STORAGE_KEY = "weaponmaster.soundVolume";

interface CombatAudioState {
  id: PlayerId;
  action: ActionState;
  weaponType: WeaponType;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private menuCrackleTimer: number | null = null;
  private menuHammerTimer: number | null = null;
  private menuActive = false;
  private gameActive = false;
  private unlocked = false;
  private volumePercent = this.loadVolumePercent();
  private readonly playedEffectIds: number[] = [];
  private readonly lastActions = new Map<PlayerId, ActionState>();

  constructor() {
    window.addEventListener("pointerdown", () => void this.unlock(), { once: true });
    window.addEventListener("keydown", () => void this.unlock(), { once: true });
  }

  getVolumePercent(): number {
    return this.volumePercent;
  }

  setVolumePercent(percent: number): void {
    this.volumePercent = Math.max(0, Math.min(100, Math.round(percent)));
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volumePercent));
    } catch {
      // Volume still applies for the current session if storage is unavailable.
    }
    this.updateMasterGain();
  }

  setMenuActive(active: boolean): void {
    this.menuActive = active;
    if (!this.unlocked) {
      return;
    }

    if (active) {
      void this.startMenuAmbience();
    } else {
      this.stopMenuAmbience();
    }
  }

  setGameActive(active: boolean): void {
    this.gameActive = active;
    if (!active) {
      this.playedEffectIds.length = 0;
      this.lastActions.clear();
    }
  }

  playNewEffects(effects: ImpactEffect[]): void {
    if (!this.unlocked || !this.gameActive) {
      return;
    }

    for (const effect of effects) {
      if (this.playedEffectIds.includes(effect.id)) {
        continue;
      }
      this.playedEffectIds.push(effect.id);
      this.playImpact(effect);
    }

    if (this.playedEffectIds.length > 96) {
      this.playedEffectIds.splice(0, this.playedEffectIds.length - 96);
    }
  }

  playCombatActions(players: CombatAudioState[]): void {
    if (!this.unlocked || !this.gameActive) {
      return;
    }

    for (const player of players) {
      const previous = this.lastActions.get(player.id);
      if (previous === player.action) {
        continue;
      }
      this.lastActions.set(player.id, player.action);
      this.playActionCue(player.action, player.weaponType);
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      return;
    }
    const context = this.getContext();
    await context.resume();
    this.unlocked = true;
    if (this.menuActive) {
      void this.startMenuAmbience();
    }
  }

  private async startMenuAmbience(): Promise<void> {
    const context = this.getContext();
    await context.resume();
    this.ensureMaster();
    if (this.menuCrackleTimer === null) {
      this.scheduleMenuCrackle();
    }
    if (this.menuHammerTimer === null) {
      this.scheduleMenuHammer();
    }
  }

  private stopMenuAmbience(): void {
    if (this.menuCrackleTimer !== null) {
      window.clearTimeout(this.menuCrackleTimer);
      this.menuCrackleTimer = null;
    }
    if (this.menuHammerTimer !== null) {
      window.clearTimeout(this.menuHammerTimer);
      this.menuHammerTimer = null;
    }
  }

  private scheduleMenuCrackle(): void {
    if (!this.menuActive) {
      this.menuCrackleTimer = null;
      return;
    }
    this.playNoiseBurst(0.035 + Math.random() * 0.05, 0.018 + Math.random() * 0.02, 1600, 0.8);
    this.menuCrackleTimer = window.setTimeout(
      () => this.scheduleMenuCrackle(),
      140 + Math.random() * 260,
    );
  }

  private scheduleMenuHammer(): void {
    if (!this.menuActive) {
      this.menuHammerTimer = null;
      return;
    }
    this.playMetalClang(0.58, 0.78);
    this.menuHammerTimer = window.setTimeout(
      () => this.scheduleMenuHammer(),
      1700 + Math.random() * 2100,
    );
  }

  private playImpact(effect: ImpactEffect): void {
    const force = Math.max(0.7, Math.min(1.8, effect.intensity));
    if (effect.type === "hit") {
      this.playBodyHit(force);
      this.playShortScrape(force * 0.5);
    } else if (effect.type === "guard") {
      this.playMetalClang(force, 0.65);
      this.playBodyHit(force * 0.35);
    } else if (effect.type === "parry") {
      this.playMetalClang(force * 1.15, 1);
      this.playTone(2100, 0.045, 0.05 * force, "triangle");
    } else if (effect.type === "clash") {
      this.playMetalClang(force, 0.88);
    } else if (effect.type === "kick") {
      this.playBodyHit(force * 0.75);
    } else if (effect.type === "dust") {
      this.playNoiseBurst(0.05, 0.012, 420, 0.5);
    }
  }

  private playActionCue(action: ActionState, weaponType: WeaponType): void {
    if (action === "charge") {
      this.playNoiseBurst(0.08, 0.028, 540, 0.7);
    } else if (action === "attack") {
      this.playWeaponSwing(weaponType);
    } else if (action === "guard") {
      this.playMetalClang(0.45, 0.45);
    } else if (action === "parry") {
      this.playTone(1420, 0.06, 0.05, "triangle");
      this.playNoiseBurst(0.05, 0.022, 1900, 1.2);
    } else if (action === "kick") {
      this.playNoiseBurst(0.08, 0.036, 340, 0.7);
    } else if (action === "guardBreak") {
      this.playWeaponSwing(weaponType, 1.25);
      this.playTone(125, 0.12, 0.045, "sine");
    } else if (action === "feint") {
      this.playNoiseBurst(0.045, 0.018, 900, 1.5);
    }
  }

  private playWeaponSwing(weaponType: WeaponType, force = 1): void {
    const weight = weaponType === "axe" ? 1.32 : weaponType === "spear" ? 0.86 : 1;
    const frequency = weaponType === "spear" ? 820 : weaponType === "axe" ? 310 : 560;
    this.playNoiseBurst(0.12 * weight, 0.034 * force * weight, frequency, 0.55);
    this.playTone(weaponType === "axe" ? 72 : 110, 0.08 * weight, 0.026 * force, "sine");
  }

  private playMetalClang(force: number, brightness: number): void {
    const volume = 0.045 * force;
    this.playTone(820 + Math.random() * 120, 0.13, volume, "triangle");
    this.playTone(1280 + Math.random() * 180, 0.09, volume * brightness, "sine");
    this.playTone(210 + Math.random() * 36, 0.16, volume * 0.55, "triangle");
    this.playNoiseBurst(0.11, 0.035 * force, 2400 + brightness * 900, 1.4);
  }

  private playBodyHit(force: number): void {
    this.playTone(90 + Math.random() * 28, 0.12, 0.05 * force, "sine");
    this.playNoiseBurst(0.08, 0.034 * force, 260, 0.9);
  }

  private playShortScrape(force: number): void {
    this.playNoiseBurst(0.12, 0.018 * force, 1100, 2.2);
  }

  private playNoiseBurst(duration: number, volume: number, frequency: number, q: number): void {
    const context = this.context;
    const master = this.ensureMaster();
    if (!context) {
      return;
    }

    const buffer = context.createBuffer(
      1,
      Math.max(1, Math.floor(context.sampleRate * duration)),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, context.currentTime);
    filter.Q.setValueAtTime(q, context.currentTime);
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(context.currentTime + duration);
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const context = this.context;
    const master = this.ensureMaster();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.76), now + duration);
    gain.gain.setValueAtTime(Math.max(0.001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private ensureMaster(): GainNode {
    const context = this.getContext();
    if (!this.master) {
      this.master = context.createGain();
      this.limiter = context.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-8, context.currentTime);
      this.limiter.knee.setValueAtTime(18, context.currentTime);
      this.limiter.ratio.setValueAtTime(8, context.currentTime);
      this.limiter.attack.setValueAtTime(0.004, context.currentTime);
      this.limiter.release.setValueAtTime(0.12, context.currentTime);
      this.master.connect(this.limiter);
      this.limiter.connect(context.destination);
      this.updateMasterGain();
    }
    return this.master;
  }

  private updateMasterGain(): void {
    if (!this.master || !this.context) {
      return;
    }
    // 50% is intentionally three times the original MVP output level.
    const multiplier = (this.volumePercent / 100) * 6;
    this.master.gain.setTargetAtTime(BASE_MASTER_GAIN * multiplier, this.context.currentTime, 0.018);
  }

  private loadVolumePercent(): number {
    try {
      const saved = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
      if (Number.isFinite(saved)) {
        return Math.max(0, Math.min(100, Math.round(saved)));
      }
    } catch {
      // Fall through to the default if browser storage is blocked.
    }
    return DEFAULT_VOLUME_PERCENT;
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }
}
