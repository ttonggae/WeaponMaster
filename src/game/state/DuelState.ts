import {
  GROUND_Y,
  PLAYER_START_DISTANCE,
} from "../constants";
import { DEFAULT_ARENA } from "../arena/ArenaData";
import type {
  ConnectionStatus,
  CoreStateSnapshot,
  DuelMode,
  ImpactEffect,
  PlayerId,
  Vec2,
  WeaponType,
} from "../types";
import { PlayerState } from "./PlayerState";

export class DuelState {
  readonly players: Record<PlayerId, PlayerState> = {
    p1: new PlayerState("p1"),
    p2: new PlayerState("p2"),
  };

  mode: DuelMode = "menu";
  frame = 0;
  time = 0;
  hitStop = 0;
  shake = 0;
  connectionStatus: ConnectionStatus = "offline";
  winner: PlayerId | null = null;
  effects: ImpactEffect[] = [];
  private nextEffectId = 1;

  startDuel(mode: DuelMode, p1Weapon: WeaponType, p2Weapon: WeaponType): void {
    const center = (DEFAULT_ARENA.left + DEFAULT_ARENA.right) / 2;
    this.mode = mode;
    this.frame = 0;
    this.time = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.winner = null;
    this.effects = [];
    this.players.p1.reset(center - PLAYER_START_DISTANCE / 2, GROUND_Y, 1, p1Weapon);
    this.players.p2.reset(center + PLAYER_START_DISTANCE / 2, GROUND_Y, -1, p2Weapon);
  }

  updateVisualTimers(dt: number): void {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.effects = this.effects
      .map((effect) => ({
        ...effect,
        position: {
          x: effect.position.x + effect.velocity.x * dt,
          y: effect.position.y + effect.velocity.y * dt,
        },
        velocity: {
          x: effect.velocity.x * 0.9,
          y: effect.velocity.y + 180 * dt,
        },
        life: effect.life - dt,
      }))
      .filter((effect) => effect.life > 0);
  }

  addEffect(
    type: ImpactEffect["type"],
    position: Vec2,
    intensity: number,
    velocity: Vec2 = { x: 0, y: 0 },
  ): void {
    this.effects.push({
      id: this.nextEffectId++,
      type,
      position,
      velocity,
      life: 0.28 + intensity * 0.04,
      maxLife: 0.28 + intensity * 0.04,
      intensity,
    });
  }

  addImpact(hitStop: number, shake: number): void {
    this.hitStop = Math.max(this.hitStop, hitStop);
    this.shake = Math.max(this.shake, shake);
  }

  snapshot(): CoreStateSnapshot {
    return {
      frame: this.frame,
      p1: this.players.p1.snapshot(),
      p2: this.players.p2.snapshot(),
    };
  }
}
