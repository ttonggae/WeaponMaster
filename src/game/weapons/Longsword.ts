import type { WeaponDefinition } from "../types";

export const LONGSWORD: WeaponDefinition = {
  type: "longsword",
  label: "Longsword",
  damage: 18,
  staminaCost: 18,
  guardDamage: 11,
  length: 96,
  range: 96,
  radius: 6,
  chargeTime: 0.28,
  followSpeed: 14,
  recoveryFollowSpeed: 11,
  timing: {
    windup: 0.05,
    active: 0.15,
    recovery: 0.26,
  },
  stun: 0.34,
  guardStun: 0.24,
  knockback: 20,
  special: "balanced",
};
