import type { WeaponDefinition } from "../types";

export const SPEAR: WeaponDefinition = {
  type: "spear",
  label: "Spear",
  damage: 16,
  staminaCost: 17,
  guardDamage: 9,
  length: 142,
  range: 142,
  radius: 5,
  chargeTime: 0.34,
  followSpeed: 10,
  recoveryFollowSpeed: 9,
  timing: {
    windup: 0.06,
    active: 0.13,
    recovery: 0.32,
  },
  stun: 0.28,
  guardStun: 0.2,
  knockback: 26,
  special: "spearSpacing",
};
