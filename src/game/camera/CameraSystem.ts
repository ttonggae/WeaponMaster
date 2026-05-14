import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../constants";
import { clamp, lerp } from "../math/geometry";
import type { DuelState } from "../state/DuelState";
import type { PlayerId, Vec2 } from "../types";
import { DEFAULT_ARENA } from "../arena/ArenaData";

export class CameraSystem {
  position: Vec2 = {
    x: (DEFAULT_ARENA.left + DEFAULT_ARENA.right) / 2,
    y: LOGICAL_HEIGHT / 2,
  };

  update(state: DuelState, focusPlayerId: PlayerId, dt: number): void {
    if (state.mode === "menu") {
      this.position.x = lerp(this.position.x, (DEFAULT_ARENA.left + DEFAULT_ARENA.right) / 2, dt * 4);
      this.position.y = lerp(this.position.y, LOGICAL_HEIGHT / 2, dt * 4);
      return;
    }

    const focus = state.players[focusPlayerId];
    const opponent = state.players[focusPlayerId === "p1" ? "p2" : "p1"];
    const distance = Math.abs(opponent.x - focus.x);
    const opponentWeight = clamp((distance - 360) / 520, 0.12, 0.42);
    const targetX = lerp(focus.x, opponent.x, opponentWeight);
    const clampedX = clamp(targetX, DEFAULT_ARENA.cameraMinX, DEFAULT_ARENA.cameraMaxX);
    const targetY = LOGICAL_HEIGHT / 2;

    this.position.x = lerp(this.position.x, clampedX, clamp(dt * 4.6, 0, 1));
    this.position.y = lerp(this.position.y, targetY, clamp(dt * 4.6, 0, 1));
  }

  worldToScreen(point: Vec2): Vec2 {
    return {
      x: point.x - this.position.x + LOGICAL_WIDTH / 2,
      y: point.y - this.position.y + LOGICAL_HEIGHT / 2,
    };
  }

  screenToWorld(point: Vec2): Vec2 {
    return {
      x: point.x + this.position.x - LOGICAL_WIDTH / 2,
      y: point.y + this.position.y - LOGICAL_HEIGHT / 2,
    };
  }
}
