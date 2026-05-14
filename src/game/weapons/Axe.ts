import type { WeaponDefinition } from "../types";

export const AXE: WeaponDefinition = {
  type: "axe",
  label: "Axe",
  damage: 27,
  staminaCost: 28,
  guardDamage: 18,
  length: 98,
  range: 98,
  radius: 8,
  chargeTime: 0.46,
  followSpeed: 7,
  recoveryFollowSpeed: 6,
  timing: {
    windup: 0.08,
    active: 0.18,
    recovery: 0.38,
  },
  stun: 0.46,
  guardStun: 0.36,
  knockback: 38,
  special: "axeGuardSlow",
};
