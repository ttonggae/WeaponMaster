export type PlayerId = "p1" | "p2";
export type ActionState =
  | "idle"
  | "charge"
  | "attack"
  | "recovery"
  | "guard"
  | "parry"
  | "feint"
  | "kick"
  | "guardBreak"
  | "stunned";
export type WeaponType = "longsword" | "spear" | "axe";
export type AttackVariant = "overhead" | "thrust" | "upswing" | "chop";
export type DuelMode = "menu" | "p2p";
export type ConnectionStatus =
  | "offline"
  | "creating-offer"
  | "waiting-answer"
  | "creating-answer"
  | "connecting"
  | "connected"
  | "closed"
  | "error";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Segment {
  start: Vec2;
  end: Vec2;
  radius: number;
}

export interface BodyPart {
  name: "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
  segment: Segment;
  color: string;
}

export interface WeaponPose {
  weaponType: WeaponType;
  handPosition: Vec2;
  gripPosition: Vec2;
  direction: Vec2;
  normal: Vec2;
  angle: number;
  length: number;
  tipPosition: Vec2;
  bladeStart: Vec2;
  bladeEnd: Vec2;
  shaftSegment: Segment;
  bladeSegment: Segment;
  blockZone: Segment;
  strikeZone: Segment;
  guardSegment?: Segment;
  headSegment?: Segment;
  headPosition?: Vec2;
  previousTipPosition?: Vec2;
  previousBladeStart?: Vec2;
  previousBladeEnd?: Vec2;
  previousStrikeZone?: Segment;
  active: boolean;
  guardActive: boolean;
  parryActive: boolean;
}

export type WeaponGeometry = WeaponPose;

export interface ControlState {
  aim: Vec2;
  attackDown: boolean;
  attackPressed: boolean;
  guardDown: boolean;
  parryPressed: boolean;
  feintPressed: boolean;
  kickPressed: boolean;
  guardBreakPressed: boolean;
  moveAxis: number;
}

export interface WeaponAttackTiming {
  windup: number;
  active: number;
  recovery: number;
}

export interface WeaponDefinition {
  type: WeaponType;
  label: string;
  damage: number;
  staminaCost: number;
  guardDamage: number;
  length: number;
  range: number;
  radius: number;
  chargeTime: number;
  followSpeed: number;
  recoveryFollowSpeed: number;
  timing: WeaponAttackTiming;
  stun: number;
  guardStun: number;
  knockback: number;
  special: "balanced" | "spearSpacing" | "axeGuardSlow";
}

export interface ImpactEffect {
  id: number;
  type: "hit" | "guard" | "parry" | "clash" | "kick" | "dust";
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  intensity: number;
}

export interface CorePlayerSnapshot {
  id: PlayerId;
  x: number;
  health: number;
  stamina: number;
  action: ActionState;
  actionTime: number;
  weaponType: WeaponType;
  weaponAngle: number;
}

export interface CoreStateSnapshot {
  frame: number;
  p1: CorePlayerSnapshot;
  p2: CorePlayerSnapshot;
}

export interface KeyBindings {
  attack: string;
  guard: string;
  parry: string;
  feint: string;
  kick: string;
  guardBreak: string;
  moveLeft: string;
  moveRight: string;
}
