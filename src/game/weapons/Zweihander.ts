import type { WeaponDefinition } from "../types";

export const ZWEIHANDER: WeaponDefinition = {
  type: "zweihander",
  label: "Zweihander",
  damage: 23,
  staminaCost: 25,
  guardDamage: 15,
  length: 122,
  range: 122,
  radius: 7,
  chargeTime: 0.38,
  followSpeed: 8.5,
  recoveryFollowSpeed: 7,
  timing: {
    windup: 0.07,
    active: 0.17,
    recovery: 0.35,
  },
  stun: 0.42,
  guardStun: 0.31,
  knockback: 30,
  special: "balanced",
};
