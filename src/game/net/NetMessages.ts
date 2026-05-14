import type {
  ControlState,
  CoreStateSnapshot,
  PlayerId,
  WeaponType,
} from "../types";

export interface ReadyMessage {
  type: "ready";
  playerId: PlayerId;
  weaponType: WeaponType;
}

export interface InputMessage {
  type: "input";
  playerId: PlayerId;
  frame: number;
  input: ControlState;
}

export interface StateMessage {
  type: "state";
  playerId: PlayerId;
  checksum: number;
  snapshot: CoreStateSnapshot;
}

export interface PingMessage {
  type: "ping";
  time: number;
}

export type NetMessage = ReadyMessage | InputMessage | StateMessage | PingMessage;
