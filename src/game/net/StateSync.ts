import { STATE_SYNC_INTERVAL_FRAMES } from "../constants";
import { lerp } from "../math/geometry";
import type { DuelState } from "../state/DuelState";
import type { ControlState, CoreStateSnapshot, PlayerId, WeaponType } from "../types";
import type { InputMessage, NetMessage, ReadyMessage, StateMessage } from "./NetMessages";

const NEUTRAL_INPUT: ControlState = {
  aim: { x: 0, y: 0 },
  attackDown: false,
  attackPressed: false,
  guardDown: false,
  parryPressed: false,
  feintPressed: false,
  kickPressed: false,
  guardBreakPressed: false,
  moveAxis: 0,
};

export class StateSync {
  private remoteInput: ControlState = { ...NEUTRAL_INPUT };
  private remoteWeapon: WeaponType = "longsword";
  private lastRemoteFrame = 0;
  private driftWarning = "";

  constructor(
    private readonly localPlayerId: PlayerId,
    private readonly remotePlayerId: PlayerId,
  ) {}

  getRemoteWeapon(): WeaponType {
    return this.remoteWeapon;
  }

  getDriftWarning(): string {
    return this.driftWarning;
  }

  consumeRemoteInput(): ControlState {
    const input = { ...this.remoteInput };
    this.remoteInput = {
      ...this.remoteInput,
      attackPressed: false,
      parryPressed: false,
      feintPressed: false,
      kickPressed: false,
      guardBreakPressed: false,
    };
    return input;
  }

  makeReadyMessage(weaponType: WeaponType): ReadyMessage {
    return {
      type: "ready",
      playerId: this.localPlayerId,
      weaponType,
    };
  }

  makeInputMessage(frame: number, input: ControlState): InputMessage {
    return {
      type: "input",
      playerId: this.localPlayerId,
      frame,
      input,
    };
  }

  shouldSendState(frame: number): boolean {
    return frame % STATE_SYNC_INTERVAL_FRAMES === 0;
  }

  makeStateMessage(state: DuelState): StateMessage {
    const snapshot = state.snapshot();
    return {
      type: "state",
      playerId: this.localPlayerId,
      checksum: this.checksum(snapshot),
      snapshot,
    };
  }

  handleMessage(message: NetMessage, state: DuelState): void {
    if (message.type === "ready") {
      this.remoteWeapon = message.weaponType;
      state.players[this.remotePlayerId].weaponType = message.weaponType;
      return;
    }
    if (message.type === "input") {
      if (message.playerId !== this.remotePlayerId || message.frame < this.lastRemoteFrame) {
        return;
      }
      this.lastRemoteFrame = message.frame;
      this.remoteInput = message.input;
      return;
    }
    if (message.type === "state") {
      this.applyRemoteState(message, state);
    }
  }

  private applyRemoteState(message: StateMessage, state: DuelState): void {
    const localChecksum = this.checksum(state.snapshot());
    if (localChecksum === message.checksum) {
      this.driftWarning = "";
      return;
    }

    const remoteSnapshot = message.snapshot[this.remotePlayerId];
    const remoteControlled = state.players[this.remotePlayerId];
    if (remoteControlled.weaponType !== remoteSnapshot.weaponType) {
      this.remoteWeapon = remoteSnapshot.weaponType;
      remoteControlled.weaponType = remoteSnapshot.weaponType;
      this.driftWarning = `Synced ${this.remotePlayerId} weapon`;
      return;
    }

    const xDelta = Math.abs(remoteControlled.x - remoteSnapshot.x);
    const healthDelta = Math.abs(remoteControlled.health - remoteSnapshot.health);

    // This is not cheat-proof. In the serverless MVP we only correct the player
    // controlled by the remote peer and keep the logic isolated for future authority.
    if (xDelta > 24 || healthDelta > 18) {
      remoteControlled.x = lerp(remoteControlled.x, remoteSnapshot.x, 0.55);
      remoteControlled.health = remoteSnapshot.health;
      remoteControlled.stamina = remoteSnapshot.stamina;
      remoteControlled.weaponType = remoteSnapshot.weaponType;
      remoteControlled.weaponAngle = remoteSnapshot.weaponAngle;
      remoteControlled.action = remoteSnapshot.action;
      remoteControlled.actionTime = remoteSnapshot.actionTime;
      remoteControlled.stunBreaksOnHit = remoteSnapshot.stunBreaksOnHit;
      this.driftWarning = `Corrected ${this.remotePlayerId} drift`;
    } else {
      this.driftWarning = "Minor state drift";
    }
  }

  private checksum(snapshot: CoreStateSnapshot): number {
    const raw = JSON.stringify(snapshot);
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
