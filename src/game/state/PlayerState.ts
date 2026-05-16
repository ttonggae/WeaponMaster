import { PLAYER_MAX_HEALTH, PLAYER_MAX_STAMINA } from "../constants";
import type {
  ActionState,
  AttackVariant,
  CorePlayerSnapshot,
  PlayerId,
  Vec2,
  WeaponGeometry,
  WeaponType,
} from "../types";

export class PlayerState {
  readonly id: PlayerId;
  x = 0;
  y = 0;
  facing: 1 | -1 = 1;
  weaponType: WeaponType = "longsword";
  health = PLAYER_MAX_HEALTH;
  stamina = PLAYER_MAX_STAMINA;
  aimPoint: Vec2 = { x: 0, y: 0 };
  weaponAngle = 0;
  visualPoseAngle = 0;
  visualHandOffset: Vec2 = { x: 22, y: -116 };
  visualPoseReady = false;
  visualLean = 0;
  action: ActionState = "idle";
  actionTime = 0;
  chargeTime = 0;
  attackBaseAngle = 0;
  attackSwingSign: 1 | -1 = 1;
  attackVariant: AttackVariant = "thrust";
  attackCharge = 0;
  attackHasHit = false;
  kickHasHit = false;
  guardBreakHasHit = false;
  stunBreaksOnHit = false;
  stunnedSeconds = 0;
  recoverySeconds = 0;
  counterWindow = 0;
  slowTimer = 0;
  slowFactor = 1;
  moveAxis = 0;
  currentWeapon: WeaponGeometry | null = null;
  previousWeapon: WeaponGeometry | null = null;

  constructor(id: PlayerId) {
    this.id = id;
  }

  reset(x: number, y: number, facing: 1 | -1, weaponType: WeaponType): void {
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.weaponType = weaponType;
    this.health = PLAYER_MAX_HEALTH;
    this.stamina = PLAYER_MAX_STAMINA;
    this.aimPoint = { x: x + facing * 100, y: y - 116 };
    this.weaponAngle = 0;
    this.visualPoseAngle = 0;
    this.visualHandOffset = { x: 22, y: -116 };
    this.visualPoseReady = false;
    this.visualLean = 0;
    this.action = "idle";
    this.actionTime = 0;
    this.chargeTime = 0;
    this.attackBaseAngle = 0;
    this.attackSwingSign = 1;
    this.attackVariant = "thrust";
    this.attackCharge = 0;
    this.attackHasHit = false;
    this.kickHasHit = false;
    this.guardBreakHasHit = false;
    this.stunBreaksOnHit = false;
    this.stunnedSeconds = 0;
    this.recoverySeconds = 0;
    this.counterWindow = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.moveAxis = 0;
    this.currentWeapon = null;
    this.previousWeapon = null;
  }

  setAction(action: ActionState): void {
    this.action = action;
    this.actionTime = 0;
  }

  snapshot(): CorePlayerSnapshot {
    return {
      id: this.id,
      x: Math.round(this.x * 10) / 10,
      health: Math.round(this.health * 10) / 10,
      stamina: Math.round(this.stamina * 10) / 10,
      action: this.action,
      actionTime: Math.round(this.actionTime * 100) / 100,
      stunBreaksOnHit: this.stunBreaksOnHit,
      weaponType: this.weaponType,
      weaponAngle: Math.round(this.weaponAngle * 100) / 100,
    };
  }
}
