import type { WeaponType } from "../types";
import { WeaponSelect } from "./WeaponSelect";

interface MenuCallbacks {
  onOpenP2P: (localWeapon: WeaponType) => void;
  onOpenOnline: (localWeapon: WeaponType) => void;
  onOpenFriendly: (localWeapon: WeaponType) => void;
}

export class Menu {
  readonly root: HTMLDivElement;
  private readonly weaponSelect = new WeaponSelect("longsword");

  constructor(parent: HTMLElement, callbacks: MenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "menu-shell";

    const panel = document.createElement("section");
    panel.className = "menu-panel";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "WeaponMaster";

    const subtitle = document.createElement("p");
    subtitle.className = "menu-subtitle";
    subtitle.textContent =
      "Heavy 1v1 medieval duel prototype. Read the weapon, manage distance, spend stamina carefully.";

    const grid = document.createElement("div");
    grid.className = "menu-grid single";
    grid.append(this.makeField("Your Weapon", this.weaponSelect.element));

    const actions = document.createElement("div");
    actions.className = "menu-actions";

    const p2pButton = this.makeButton("P2P Duel", "");
    p2pButton.addEventListener("click", () => {
      callbacks.onOpenP2P(this.weaponSelect.value);
    });
    const matchmakingButton = this.makeButton("Online Matchmaking", "primary");
    matchmakingButton.addEventListener("click", () => {
      callbacks.onOpenOnline(this.weaponSelect.value);
    });
    const friendlyButton = this.makeButton("Friendly Match", "");
    friendlyButton.addEventListener("click", () => {
      callbacks.onOpenFriendly(this.weaponSelect.value);
    });

    actions.append(matchmakingButton, friendlyButton, p2pButton);
    panel.append(title, subtitle, grid, actions);
    this.root.append(panel);
    parent.append(this.root);
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  private makeField(labelText: string, field: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "field-label";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, field);
    return label;
  }

  private makeButton(text: string, variant: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${variant}`.trim();
    button.textContent = text;
    return button;
  }
}
