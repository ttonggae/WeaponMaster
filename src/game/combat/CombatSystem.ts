import {
  ARENA_LEFT,
  ARENA_RIGHT,
  ATTACK_MOVE_MULTIPLIER,
  CHARGE_MOVE_MULTIPLIER,
  DEFAULT_HITSTOP_SECONDS,
  FEINT_STAMINA_COST,
  GUARD_BREAK_GUARD_STUN_SECONDS,
  GUARD_BREAK_KNOCKBACK,
  GUARD_BREAK_SECONDS,
  GUARD_BREAK_STAMINA_COST,
  GUARD_MOVE_MULTIPLIER,
  HEAVY_HITSTOP_SECONDS,
  KICK_ACTIVE_END,
  KICK_ACTIVE_START,
  KICK_DAMAGE,
  KICK_KNOCKBACK,
  KICK_RANGE,
  KICK_SECONDS,
  KICK_STAMINA_COST,
  KICK_STUN_SECONDS,
  MIN_PLAYER_DISTANCE,
  MOVE_SPEED,
  PARRY_DAMAGE_MULTIPLIER,
  PARRY_STAMINA_COST,
  PARRY_TOTAL_SECONDS,
  STUNNED_MOVE_MULTIPLIER,
} from "../constants";
import { clamp, lerpAngle } from "../math/geometry";
import type { DuelState } from "../state/DuelState";
import type { PlayerState } from "../state/PlayerState";
import type { AttackVariant, ControlState, PlayerId, Vec2 } from "../types";
import { getWeaponData } from "../weapons/weaponData";
import { WeaponPoseSystem } from "../weapons/WeaponPoseSystem";
import { CharacterRenderer } from "../render/CharacterRenderer";
import { capsulesOverlap, segmentMidpoint } from "../math/geometry";
import { GuardSystem } from "./GuardSystem";
import { HitboxSystem } from "./HitboxSystem";
import { ParrySystem } from "./ParrySystem";
import { StaminaSystem } from "./StaminaSystem";

const NEUTRAL_CONTROL: ControlState = {
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

export class CombatSystem {
  private readonly stamina = new StaminaSystem();
  private readonly guard = new GuardSystem();
  private readonly parry = new ParrySystem();
  private readonly hitboxes = new HitboxSystem();

  update(state: DuelState, controls: Partial<Record<PlayerId, ControlState>>, dt: number): void {
    if (state.mode === "menu" || state.winner) {
      return;
    }

    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt);
      return;
    }

    state.frame += 1;
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    p1.facing = p1.x <= p2.x ? 1 : -1;
    p2.facing = p2.x <= p1.x ? 1 : -1;

    this.updatePlayer(state, p1, controls.p1 ?? NEUTRAL_CONTROL, dt);
    this.updatePlayer(state, p2, controls.p2 ?? NEUTRAL_CONTROL, dt);
    this.constrainPlayers(p1, p2);
    this.updateWeaponGeometry(p1, p2, dt);

    this.resolveWeaponClash(state, p1, p2);
    this.resolveAttack(state, p1, p2);
    this.resolveAttack(state, p2, p1);
    this.resolveGuardBreak(state, p1, p2);
    this.resolveGuardBreak(state, p2, p1);
    this.resolveKick(state, p1, p2);
    this.resolveKick(state, p2, p1);
    this.constrainPlayers(p1, p2);
    this.resolveWinner(state);

    p1.previousWeapon = p1.currentWeapon;
    p2.previousWeapon = p2.currentWeapon;
  }

  private updatePlayer(
    state: DuelState,
    player: PlayerState,
    controls: ControlState,
    dt: number,
  ): void {
    this.updateStatusTimers(player, dt);
    this.stamina.update(player, dt);
    this.updateWeaponTracking(player, controls, dt);

    const actionSpeed = this.stamina.actionSpeed(player);
    player.actionTime += dt * actionSpeed;
    this.applyMovement(player, controls, dt);
    this.updateVisualBody(player, dt);

    if (player.action === "stunned") {
      if (player.actionTime >= player.stunnedSeconds) {
        player.stunBreaksOnHit = false;
        player.setAction("idle");
      }
      return;
    }

    if (player.action === "recovery") {
      if (player.actionTime >= player.recoverySeconds) {
        player.setAction("idle");
      }
      return;
    }

    if (player.action === "parry") {
      if (player.actionTime >= PARRY_TOTAL_SECONDS) {
        this.beginRecovery(player, 0.18);
      }
      return;
    }

    if (player.action === "kick") {
      if (player.actionTime >= KICK_SECONDS) {
        player.setAction("idle");
      }
      return;
    }

    if (player.action === "guardBreak") {
      if (player.actionTime >= GUARD_BREAK_SECONDS) {
        this.beginRecovery(player, 0.22);
      }
      return;
    }

    if (player.action === "attack") {
      const data = getWeaponData(player.weaponType);
      if (player.actionTime >= data.timing.windup + data.timing.active) {
        this.beginRecovery(player, data.timing.recovery);
      }
      return;
    }

    if (player.action === "guard") {
      if (!controls.guardDown || player.stamina <= 0) {
        player.setAction("idle");
      }
      return;
    }

    if (player.action === "charge") {
      if (controls.feintPressed) {
        this.tryFeint(state, player);
        return;
      }
      const data = getWeaponData(player.weaponType);
      if (player.actionTime >= data.chargeTime) {
        this.beginAttack(player);
      }
      return;
    }

    if (controls.parryPressed) {
      this.tryBeginParry(state, player);
      return;
    }
    if (controls.kickPressed) {
      this.tryBeginKick(state, player);
      return;
    }
    if (controls.guardBreakPressed) {
      this.tryBeginGuardBreak(state, player);
      return;
    }
    if (controls.attackPressed) {
      this.tryBeginCharge(state, player);
      return;
    }
    if (controls.guardDown) {
      player.setAction("guard");
    }
  }

  private updateWeaponTracking(player: PlayerState, controls: ControlState, dt: number): void {
    player.aimPoint = controls.aim;
    player.moveAxis = controls.moveAxis;
    const data = getWeaponData(player.weaponType);
    const targetAngle = this.targetAngleFromAim(player, controls.aim);

    let speed = data.followSpeed;
    if (player.action === "guard") {
      speed *= 0.5;
    } else if (player.action === "recovery" || player.action === "feint") {
      speed = data.recoveryFollowSpeed;
    } else if (player.action === "charge" || player.action === "attack") {
      speed = 0;
    } else if (player.action === "guardBreak") {
      speed *= 0.35;
    } else if (player.action === "stunned") {
      speed *= 0.25;
    }

    const t = clamp(speed * dt, 0, 1);
    player.weaponAngle = lerpAngle(player.weaponAngle, targetAngle, t);
  }

  private targetAngleFromAim(player: PlayerState, aim: Vec2): number {
    const grip = {
      x: player.x + player.facing * 22,
      y: player.y - 116,
    };
    const localX = (aim.x - grip.x) * player.facing;
    const localY = aim.y - grip.y;
    if (Math.hypot(localX, localY) < 18) {
      return player.weaponAngle;
    }
    return clamp(Math.atan2(localY, Math.max(18, localX)), -1.28, 1.08);
  }

  private updateStatusTimers(player: PlayerState, dt: number): void {
    player.counterWindow = Math.max(0, player.counterWindow - dt);
    player.slowTimer = Math.max(0, player.slowTimer - dt);
    if (player.slowTimer <= 0) {
      player.slowFactor = 1;
    }
  }

  private applyMovement(player: PlayerState, controls: ControlState, dt: number): void {
    const multiplier = this.moveMultiplier(player);
    player.x += controls.moveAxis * MOVE_SPEED * multiplier * dt;
    player.x = clamp(player.x, ARENA_LEFT, ARENA_RIGHT);
  }

  private updateVisualBody(player: PlayerState, dt: number): void {
    const target = this.targetLean(player);
    const speed =
      player.action === "attack" || player.action === "parry"
        ? 18
        : player.action === "stunned" || player.action === "guardBreak"
          ? 10
          : 8;
    player.visualLean += (target - player.visualLean) * clamp(speed * dt, 0, 1);
  }

  private targetLean(player: PlayerState): number {
    if (player.action === "attack") {
      const t = Math.sin(Math.min(1, player.actionTime / 0.22) * Math.PI);
      return player.facing * (8 + t * (player.weaponType === "spear" ? 10 : player.weaponType === "zweihander" ? 7 : 5));
    }
    if (player.action === "charge") {
      const chargeTime =
        player.weaponType === "axe" ? 0.46 : player.weaponType === "spear" ? 0.34 : player.weaponType === "zweihander" ? 0.38 : 0.28;
      const t = Math.min(1, player.actionTime / chargeTime);
      return -player.facing * (player.weaponType === "axe" ? 10 : player.weaponType === "zweihander" ? 8 : 6) * t;
    }
    if (player.action === "recovery") {
      return -player.facing * (player.weaponType === "axe" ? 9 : player.weaponType === "zweihander" ? 7 : 5);
    }
    if (player.action === "guard" || player.action === "parry") {
      return -player.facing * (player.action === "parry" ? 1 : 4);
    }
    if (player.action === "stunned") {
      return -player.facing * 14;
    }
    if (player.action === "kick") {
      return -player.facing * 8;
    }
    if (player.action === "guardBreak") {
      return player.facing * 14;
    }
    if (player.moveAxis !== 0) {
      return player.moveAxis * 4;
    }
    return 0;
  }

  private moveMultiplier(player: PlayerState): number {
    if (player.action === "guard") {
      return GUARD_MOVE_MULTIPLIER;
    }
    if (player.action === "charge" || player.action === "guardBreak") {
      return CHARGE_MOVE_MULTIPLIER;
    }
    if (player.action === "attack" || player.action === "recovery") {
      return ATTACK_MOVE_MULTIPLIER;
    }
    if (player.action === "stunned") {
      return STUNNED_MOVE_MULTIPLIER;
    }
    return 1;
  }

  private tryBeginCharge(state: DuelState, player: PlayerState): void {
    const data = getWeaponData(player.weaponType);
    if (!this.stamina.trySpend(player, data.staminaCost)) {
      this.makeWinded(state, player, 0.34);
      return;
    }
    player.attackBaseAngle = player.weaponAngle;
    player.attackSwingSign = player.weaponAngle < -0.05 ? 1 : -1;
    player.attackVariant = this.chooseAttackVariant(player);
    player.attackHasHit = false;
    player.attackCharge = 1;
    player.setAction("charge");
  }

  private chooseAttackVariant(player: PlayerState): AttackVariant {
    if (player.weaponType === "spear") {
      return "thrust";
    }
    if (player.weaponType === "axe") {
      return player.weaponAngle < -0.18 ? "chop" : player.weaponAngle > 0.28 ? "upswing" : "chop";
    }
    if (player.weaponType === "zweihander") {
      if (player.weaponAngle < -0.26) {
        return "overhead";
      }
      if (player.weaponAngle > 0.24) {
        return "upswing";
      }
      return "thrust";
    }
    if (player.weaponAngle < -0.32) {
      return "overhead";
    }
    if (player.weaponAngle > 0.3) {
      return "upswing";
    }
    return "thrust";
  }

  private beginAttack(player: PlayerState): void {
    const data = getWeaponData(player.weaponType);
    const counterBoost = player.counterWindow > 0;
    player.counterWindow = 0;
    player.setAction("attack");
    if (counterBoost) {
      player.actionTime = data.timing.windup * 0.45;
    }
  }

  private beginRecovery(player: PlayerState, seconds: number): void {
    player.recoverySeconds = seconds;
    player.setAction("recovery");
  }

  private tryFeint(state: DuelState, player: PlayerState): void {
    if (!this.stamina.trySpend(player, FEINT_STAMINA_COST)) {
      this.makeWinded(state, player, 0.28);
      return;
    }
    player.attackCharge = 0;
    player.attackHasHit = false;
    player.setAction("idle");
  }

  private tryBeginParry(state: DuelState, player: PlayerState): void {
    if (!this.stamina.trySpend(player, PARRY_STAMINA_COST)) {
      this.makeWinded(state, player, 0.3);
      return;
    }
    player.setAction("parry");
  }

  private tryBeginKick(state: DuelState, player: PlayerState): void {
    if (!this.stamina.trySpend(player, KICK_STAMINA_COST)) {
      this.makeWinded(state, player, 0.28);
      return;
    }
    player.kickHasHit = false;
    player.setAction("kick");
  }

  private tryBeginGuardBreak(state: DuelState, player: PlayerState): void {
    if (!this.stamina.trySpend(player, GUARD_BREAK_STAMINA_COST)) {
      this.makeWinded(state, player, 0.34);
      return;
    }
    player.guardBreakHasHit = false;
    player.setAction("guardBreak");
  }

  private makeWinded(state: DuelState, player: PlayerState, seconds: number): void {
    player.stunnedSeconds = seconds;
    player.setAction("stunned");
    state.addEffect("dust", { x: player.x, y: player.y - 34 }, 1.2);
  }

  private updateWeaponGeometry(p1: PlayerState, p2: PlayerState, dt: number): void {
    p1.currentWeapon = WeaponPoseSystem.compute(p1, dt);
    p2.currentWeapon = WeaponPoseSystem.compute(p2, dt);
  }

  private resolveWeaponClash(state: DuelState, p1: PlayerState, p2: PlayerState): void {
    if (p1.attackHasHit || p2.attackHasHit) {
      return;
    }
    const clash = this.hitboxes.weaponsClash(p1, p2);
    if (!clash.hit) {
      return;
    }

    p1.attackHasHit = true;
    p2.attackHasHit = true;
    p1.stunnedSeconds = 0.16;
    p2.stunnedSeconds = 0.16;
    p1.setAction("stunned");
    p2.setAction("stunned");
    state.addEffect("clash", clash.point, 2.1);
    state.addImpact(DEFAULT_HITSTOP_SECONDS, 4.5);
  }

  private resolveAttack(state: DuelState, attacker: PlayerState, defender: PlayerState): void {
    if (
      attacker.action !== "attack" ||
      attacker.attackHasHit ||
      !attacker.currentWeapon?.active
    ) {
      return;
    }

    const weapon = getWeaponData(attacker.weaponType);
    const weaponContact = this.hitboxes.weaponSweepIntersectsWeapon(attacker, defender);

    if (this.parry.canParry(defender) && weaponContact.hit) {
      const parryWeapon = getWeaponData(defender.weaponType);
      const parryDamage = parryWeapon.damage * PARRY_DAMAGE_MULTIPLIER;
      attacker.attackHasHit = true;
      attacker.health = clamp(attacker.health - parryDamage, 0, 100);
      attacker.stunnedSeconds = 0.48;
      attacker.setAction("stunned");
      defender.counterWindow = 0.55;
      if (defender.weaponType === "spear") {
        attacker.x += defender.facing * 42;
      }
      state.addEffect("parry", weaponContact.point, 2.5, {
        x: -attacker.facing * 36,
        y: -18,
      });
      state.addEffect("hit", weaponContact.point, parryDamage > 28 ? 2.6 : 2.1, {
        x: -attacker.facing * 24,
        y: -18,
      });
      state.addImpact(HEAVY_HITSTOP_SECONDS, 6);
      return;
    }

    if (this.guard.canGuard(defender) && weaponContact.hit) {
      attacker.attackHasHit = true;
      const point = this.guard.applyGuardImpact(defender, attacker.facing, weapon);
      defender.health = clamp(defender.health - weapon.guardDamage * 0.08, 0, 100);
      state.addEffect("guard", point, weapon.special === "axeGuardSlow" ? 2.4 : 1.8, {
        x: attacker.facing * 16,
        y: -12,
      });
      state.addImpact(DEFAULT_HITSTOP_SECONDS, weapon.special === "axeGuardSlow" ? 5.5 : 4);
      return;
    }

    const hit = this.hitboxes.weaponSweepHitsPlayer(attacker, defender);
    if (!hit.hit) {
      return;
    }

    attacker.attackHasHit = true;
    const damage = weapon.damage * (1 + attacker.attackCharge * 0.16);
    defender.health = clamp(defender.health - damage, 0, 100);
    this.applyHitStun(defender, weapon.stun);
    defender.x += attacker.facing * weapon.knockback;
    if (weapon.special === "axeGuardSlow") {
      defender.slowTimer = Math.max(defender.slowTimer, 0.45);
      defender.slowFactor = 0.78;
    }
    state.addEffect("hit", hit.point, weapon.damage > 22 ? 2.8 : 2.1, {
      x: attacker.facing * 32,
      y: -24,
    });
    state.addImpact(weapon.damage > 22 ? HEAVY_HITSTOP_SECONDS : DEFAULT_HITSTOP_SECONDS, 6);
  }

  private resolveGuardBreak(
    state: DuelState,
    attacker: PlayerState,
    defender: PlayerState,
  ): void {
    if (
      attacker.action !== "guardBreak" ||
      attacker.guardBreakHasHit ||
      !attacker.currentWeapon?.active
    ) {
      return;
    }

    const weaponContact = this.hitboxes.weaponSweepIntersectsWeapon(attacker, defender);
    const bodyHit = this.hitboxes.weaponSweepHitsPlayer(attacker, defender);
    if (!weaponContact.hit && !bodyHit.hit) {
      return;
    }

    attacker.guardBreakHasHit = true;
    const point = weaponContact.hit ? weaponContact.point : bodyHit.point;
    if (defender.action !== "guard") {
      return;
    }

    defender.stamina = clamp(defender.stamina - 26, 0, 100);
    defender.stunnedSeconds = GUARD_BREAK_GUARD_STUN_SECONDS;
    defender.stunBreaksOnHit = true;
    defender.setAction("stunned");
    defender.x += attacker.facing * GUARD_BREAK_KNOCKBACK;
    state.addEffect("guard", point, 2.7, { x: attacker.facing * 24, y: -14 });
    state.addImpact(HEAVY_HITSTOP_SECONDS, 6.5);
  }

  private resolveKick(state: DuelState, attacker: PlayerState, defender: PlayerState): void {
    if (
      attacker.action !== "kick" ||
      attacker.kickHasHit ||
      attacker.actionTime < KICK_ACTIVE_START ||
      attacker.actionTime > KICK_ACTIVE_END
    ) {
      return;
    }

    const kickHitbox = CharacterRenderer.computeKickHitbox(attacker);
    if (!kickHitbox) {
      return;
    }
    const bodyParts = CharacterRenderer.computeBodyParts(defender, defender.currentWeapon);
    const hitPart = bodyParts.find((part) => capsulesOverlap(kickHitbox, part.segment));
    if (!hitPart) {
      return;
    }

    attacker.kickHasHit = true;
    const guarded = defender.action === "guard";
    defender.health = clamp(defender.health - (guarded ? 1 : KICK_DAMAGE), 0, 100);
    defender.x += attacker.facing * (guarded ? KICK_KNOCKBACK * 0.62 : KICK_KNOCKBACK);
    this.applyHitStun(defender, KICK_STUN_SECONDS);
    state.addEffect("kick", segmentMidpoint(kickHitbox), guarded ? 1.2 : 1.8, {
      x: attacker.facing * 30,
      y: -10,
    });
    state.addImpact(DEFAULT_HITSTOP_SECONDS, 4);
  }

  private constrainPlayers(p1: PlayerState, p2: PlayerState): void {
    p1.x = clamp(p1.x, ARENA_LEFT, ARENA_RIGHT);
    p2.x = clamp(p2.x, ARENA_LEFT, ARENA_RIGHT);

    const distance = Math.abs(p2.x - p1.x);
    if (distance >= MIN_PLAYER_DISTANCE) {
      return;
    }

    const midpoint = (p1.x + p2.x) / 2;
    const half = MIN_PLAYER_DISTANCE / 2;
    if (p1.x <= p2.x) {
      p1.x = clamp(midpoint - half, ARENA_LEFT, ARENA_RIGHT);
      p2.x = clamp(midpoint + half, ARENA_LEFT, ARENA_RIGHT);
    } else {
      p1.x = clamp(midpoint + half, ARENA_LEFT, ARENA_RIGHT);
      p2.x = clamp(midpoint - half, ARENA_LEFT, ARENA_RIGHT);
    }
  }

  private resolveWinner(state: DuelState): void {
    if (state.players.p1.health <= 0) {
      state.winner = "p2";
    } else if (state.players.p2.health <= 0) {
      state.winner = "p1";
    }
  }

  private applyHitStun(defender: PlayerState, stunSeconds: number): void {
    if (defender.stunBreaksOnHit) {
      defender.stunBreaksOnHit = false;
      defender.stunnedSeconds = 0;
      defender.setAction("idle");
      return;
    }

    defender.stunnedSeconds = stunSeconds;
    defender.setAction("stunned");
  }
}
