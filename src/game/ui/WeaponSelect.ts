import type { WeaponType } from "../types";
import { WEAPON_LABELS, WEAPON_TYPES } from "../weapons/weaponTypes";

export class WeaponSelect {
  readonly element: HTMLSelectElement;

  constructor(initial: WeaponType) {
    this.element = document.createElement("select");
    this.element.className = "weapon-select";

    for (const type of WEAPON_TYPES) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = WEAPON_LABELS[type];
      this.element.append(option);
    }
    this.element.value = initial;
  }

  get value(): WeaponType {
    return this.element.value as WeaponType;
  }

  set value(type: WeaponType) {
    this.element.value = type;
  }
}
