import type { WeaponDefinition, WeaponType } from "../types";
import { AXE } from "./Axe";
import { LONGSWORD } from "./Longsword";
import { SPEAR } from "./Spear";
import { ZWEIHANDER } from "./Zweihander";

export const WEAPON_DATA: Record<WeaponType, WeaponDefinition> = {
  longsword: LONGSWORD,
  spear: SPEAR,
  axe: AXE,
  zweihander: ZWEIHANDER,
};

export function getWeaponData(type: WeaponType): WeaponDefinition {
  return WEAPON_DATA[type];
}
