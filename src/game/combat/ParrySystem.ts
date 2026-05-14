import { PARRY_ACTIVE_SECONDS } from "../constants";
import type { PlayerState } from "../state/PlayerState";

export class ParrySystem {
  canParry(defender: PlayerState): boolean {
    return (
      defender.action === "parry" &&
      defender.actionTime <= PARRY_ACTIVE_SECONDS &&
      Boolean(defender.currentWeapon?.parryActive)
    );
  }
}
