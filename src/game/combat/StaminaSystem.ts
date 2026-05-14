import {
  EXHAUSTED_ACTION_SPEED,
  EXHAUSTED_STAMINA_THRESHOLD,
  GUARD_STAMINA_DRAIN_PER_SECOND,
  PLAYER_MAX_STAMINA,
  STAMINA_REGEN_PER_SECOND,
} from "../constants";
import type { PlayerState } from "../state/PlayerState";
import { clamp } from "../math/geometry";

export class StaminaSystem {
  update(player: PlayerState, dt: number): void {
    if (player.action === "guard") {
      player.stamina = clamp(
        player.stamina - GUARD_STAMINA_DRAIN_PER_SECOND * dt,
        0,
        PLAYER_MAX_STAMINA,
      );
      return;
    }

    const regenMultiplier = player.action === "idle" ? 1 : 0.38;
    player.stamina = clamp(
      player.stamina + STAMINA_REGEN_PER_SECOND * regenMultiplier * dt,
      0,
      PLAYER_MAX_STAMINA,
    );
  }

  trySpend(player: PlayerState, amount: number): boolean {
    if (player.stamina < amount) {
      return false;
    }
    player.stamina = clamp(player.stamina - amount, 0, PLAYER_MAX_STAMINA);
    return true;
  }

  actionSpeed(player: PlayerState): number {
    const exhausted = player.stamina < EXHAUSTED_STAMINA_THRESHOLD;
    return (exhausted ? EXHAUSTED_ACTION_SPEED : 1) * player.slowFactor;
  }
}
