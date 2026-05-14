import type { PlayerState } from "../state/PlayerState";
import type { Vec2, WeaponDefinition } from "../types";
import { clamp } from "../math/geometry";

export class GuardSystem {
  canGuard(defender: PlayerState): boolean {
    return defender.action === "guard" && defender.stamina > 0;
  }

  applyGuardImpact(
    defender: PlayerState,
    attackerFacing: 1 | -1,
    weapon: WeaponDefinition,
  ): Vec2 {
    defender.stamina = clamp(defender.stamina - weapon.guardDamage, 0, 100);
    defender.stunnedSeconds = weapon.guardStun + (defender.stamina <= 0 ? 0.18 : 0);
    defender.setAction("stunned");
    defender.x += attackerFacing * (weapon.knockback * 0.45);

    if (weapon.special === "axeGuardSlow") {
      defender.slowTimer = Math.max(defender.slowTimer, 0.85);
      defender.slowFactor = 0.68;
    }

    return {
      x: defender.x - attackerFacing * 22,
      y: defender.y - 116,
    };
  }
}
