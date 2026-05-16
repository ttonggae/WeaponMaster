import type { WeaponType } from "../types";

export const WEAPON_TYPES: WeaponType[] = ["longsword", "spear", "axe", "zweihander"];

export const WEAPON_LABELS: Record<WeaponType, string> = {
  longsword: "Longsword",
  spear: "Spear",
  axe: "Axe",
  zweihander: "Zweihander",
};
