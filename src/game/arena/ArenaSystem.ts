import { clamp } from "../math/geometry";
import { DEFAULT_ARENA, type ArenaData } from "./ArenaData";

export class ArenaSystem {
  constructor(readonly data: ArenaData = DEFAULT_ARENA) {}

  clampX(x: number): number {
    return clamp(x, this.data.left, this.data.right);
  }

  centerX(): number {
    return (this.data.left + this.data.right) / 2;
  }
}
