import {
  CURRENT_SEASON_NAME,
  CURRENT_SEASON_NUMBER,
  MOVE_SPEED,
  PLAYER_MAX_HEALTH,
  PLAYER_MAX_STAMINA,
} from "../constants";
import type { LeaderboardEntry, WeaponDefinition, WeaponType } from "../types";
import { WEAPON_TYPES } from "../weapons/weaponTypes";
import { getWeaponData } from "../weapons/weaponData";

interface MenuCallbacks {
  onStartRanked: (localWeapon: WeaponType) => void;
  onStartCasual: (localWeapon: WeaponType) => void;
  onOpenFriendly: (localWeapon: WeaponType) => void;
}

type LoadoutItemKind = "weapon" | "gear" | "armor" | "passive";

interface LoadoutItem {
  id: string;
  kind: LoadoutItemKind;
  label: string;
  locked: boolean;
  weaponType?: WeaponType;
  description: string;
}

const LOCKED_ITEMS: LoadoutItem[] = [
  {
    id: "gear-locked",
    kind: "gear",
    label: "Gear Slot",
    locked: true,
    description: "Equipment and consumable utility slots are reserved for a future update.",
  },
  {
    id: "armor-locked",
    kind: "armor",
    label: "Armor Slot",
    locked: true,
    description: "Armor will later modify protection, stamina pressure, and movement weight.",
  },
  {
    id: "passive-locked",
    kind: "passive",
    label: "Passive Slot",
    locked: true,
    description: "Passive traits will later define season builds and weapon specializations.",
  },
];

export class Menu {
  readonly root: HTMLDivElement;
  private selectedWeapon: WeaponType = "longsword";
  private selectedItem: LoadoutItem = this.weaponToItem("longsword");
  private readonly accountLine = document.createElement("div");
  private readonly scoreLine = document.createElement("div");
  private readonly leaderboardList = document.createElement("ol");
  private readonly equippedLine = document.createElement("div");
  private readonly loadoutOverlay = document.createElement("div");
  private readonly characterPreview = document.createElement("div");
  private readonly statGrid = document.createElement("dl");
  private readonly detailTitle = document.createElement("h3");
  private readonly detailDescription = document.createElement("p");
  private readonly detailStats = document.createElement("dl");
  private readonly equipButton = document.createElement("button");
  private readonly weaponButtons = new Map<WeaponType, HTMLButtonElement>();
  private readonly slotButtons = new Map<string, HTMLButtonElement>();

  constructor(parent: HTMLElement, callbacks: MenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "menu-shell";

    const panel = document.createElement("div");
    panel.className = "menu-panel";

    const titleBlock = document.createElement("section");
    titleBlock.className = "menu-title-block";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "WeaponMaster";

    const season = document.createElement("div");
    season.className = "season-badge";
    season.textContent = `Season ${CURRENT_SEASON_NUMBER}: ${CURRENT_SEASON_NAME}`;

    const subtitle = document.createElement("p");
    subtitle.className = "menu-subtitle";
    subtitle.textContent =
      "Heavy medieval duels built around commitment, distance, stamina, and visible steel.";

    this.accountLine.className = "account-line";
    this.accountLine.textContent = "Google sign-in is restored automatically after the first login.";
    titleBlock.append(title, season, subtitle, this.accountLine);

    const rankPanel = document.createElement("section");
    rankPanel.className = "leaderboard-panel";
    const leaderboardTitle = document.createElement("h2");
    leaderboardTitle.textContent = "Season Top 10";
    this.leaderboardList.className = "leaderboard-list";
    this.leaderboardList.innerHTML = "<li>Loading rankings...</li>";
    this.scoreLine.className = "score-line";
    this.scoreLine.textContent = "Score: not signed in";
    rankPanel.append(leaderboardTitle, this.leaderboardList, this.scoreLine);

    const matchPanel = document.createElement("section");
    matchPanel.className = "match-menu-panel";

    this.equippedLine.className = "equipped-line";
    this.updateEquippedLine();

    const loadoutButton = this.makeButton("Loadout", "secondary");
    loadoutButton.addEventListener("click", () => this.openLoadout());

    const actionGrid = document.createElement("div");
    actionGrid.className = "menu-actions";
    const rankedButton = this.makeButton("Ranked Match", "primary");
    rankedButton.addEventListener("click", () => {
      callbacks.onStartRanked(this.selectedWeapon);
    });

    const casualButton = this.makeButton("Casual Match", "");
    casualButton.addEventListener("click", () => {
      callbacks.onStartCasual(this.selectedWeapon);
    });

    const friendlyButton = this.makeButton("Friendly Match", "");
    friendlyButton.addEventListener("click", () => {
      callbacks.onOpenFriendly(this.selectedWeapon);
    });

    actionGrid.append(rankedButton, casualButton, friendlyButton);
    matchPanel.append(loadoutButton, this.equippedLine, actionGrid);

    panel.append(titleBlock, rankPanel, matchPanel);
    this.root.append(panel, this.buildLoadoutOverlay());
    parent.append(this.root);
    this.refreshLoadout();
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.closeLoadout();
    this.root.classList.add("hidden");
  }

  setAccountName(name: string): void {
    this.accountLine.textContent = `Signed in as ${name}`;
  }

  setAccountStatus(text: string): void {
    this.accountLine.textContent = text;
  }

  setPlayerScore(entry: LeaderboardEntry | null): void {
    if (!entry) {
      this.scoreLine.textContent = "Your Score: not signed in";
      return;
    }
    this.scoreLine.textContent = `Your Score: ${entry.score} (${entry.wins}W/${entry.losses}L)`;
  }

  setLeaderboard(entries: LeaderboardEntry[]): void {
    if (entries.length === 0) {
      this.leaderboardList.innerHTML = "<li>No ranked records yet.</li>";
      return;
    }

    this.leaderboardList.replaceChildren(
      ...entries.map((entry) => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        const score = document.createElement("strong");
        name.textContent = `${entry.displayName} (${entry.wins}W/${entry.losses}L)`;
        score.textContent = String(entry.score);
        item.append(name, score);
        return item;
      }),
    );
  }

  private buildLoadoutOverlay(): HTMLElement {
    this.loadoutOverlay.className = "loadout-overlay hidden";

    const modal = document.createElement("section");
    modal.className = "loadout-modal";

    const header = document.createElement("header");
    header.className = "loadout-header";
    const title = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = "Loadout";
    const note = document.createElement("p");
    note.textContent = "Weapon is active now. Armor, gear, and passive slots are locked for later seasons.";
    title.append(heading, note);
    const close = this.makeButton("Close", "ghost");
    close.addEventListener("click", () => this.closeLoadout());
    header.append(title, close);

    const body = document.createElement("div");
    body.className = "loadout-body";

    const stage = document.createElement("section");
    stage.className = "loadout-stage";
    const topSlot = this.makeSlotButton(LOCKED_ITEMS[2], "top");
    const leftSlot = this.makeSlotButton(this.weaponToItem(this.selectedWeapon), "left");
    const rightSlot = this.makeSlotButton(LOCKED_ITEMS[1], "right");
    const bottomSlot = this.makeSlotButton(LOCKED_ITEMS[0], "bottom");

    this.characterPreview.className = "loadout-character";
    this.characterPreview.append(
      this.makePart("preview-head"),
      this.makePart("preview-torso"),
      this.makePart("preview-arm left"),
      this.makePart("preview-arm right"),
      this.makePart("preview-leg left"),
      this.makePart("preview-leg right"),
      this.makePart("preview-weapon"),
    );

    const statPanel = document.createElement("section");
    statPanel.className = "loadout-stat-panel";
    const statTitle = document.createElement("h3");
    statTitle.textContent = "Current Stats";
    this.statGrid.className = "stat-grid";
    statPanel.append(statTitle, this.statGrid);

    stage.append(topSlot, leftSlot, this.characterPreview, rightSlot, bottomSlot, statPanel);

    const inventory = document.createElement("section");
    inventory.className = "loadout-inventory";
    const inventoryTitle = document.createElement("h3");
    inventoryTitle.textContent = "Equipment";
    const weaponList = document.createElement("div");
    weaponList.className = "inventory-list";
    for (const weaponType of WEAPON_TYPES) {
      const item = this.weaponToItem(weaponType);
      const button = this.makeInventoryButton(item);
      this.weaponButtons.set(weaponType, button);
      weaponList.append(button);
    }
    for (const item of LOCKED_ITEMS) {
      weaponList.append(this.makeInventoryButton(item));
    }
    inventory.append(inventoryTitle, weaponList);

    const details = document.createElement("section");
    details.className = "loadout-details";
    this.detailTitle.textContent = "";
    this.detailDescription.textContent = "";
    this.detailStats.className = "stat-grid detail";
    this.equipButton.type = "button";
    this.equipButton.className = "button primary";
    this.equipButton.addEventListener("click", () => this.equipSelectedItem());
    details.append(this.detailTitle, this.detailDescription, this.detailStats, this.equipButton);

    body.append(stage, inventory, details);
    modal.append(header, body);
    this.loadoutOverlay.append(modal);
    return this.loadoutOverlay;
  }

  private makeSlotButton(item: LoadoutItem, position: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `equipment-slot ${position}${item.locked ? " locked" : ""}`;
    button.textContent = item.label;
    button.addEventListener("click", () => this.selectItem(item));
    this.slotButtons.set(item.kind, button);
    return button;
  }

  private makeInventoryButton(item: LoadoutItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-item ${item.locked ? "locked" : ""}`;
    const type = document.createElement("span");
    const name = document.createElement("strong");
    type.textContent = item.kind;
    name.textContent = item.label;
    button.append(type, name);
    button.addEventListener("click", () => this.selectItem(item));
    return button;
  }

  private selectItem(item: LoadoutItem): void {
    this.selectedItem = item;
    this.refreshLoadout();
  }

  private equipSelectedItem(): void {
    if (!this.selectedItem.weaponType || this.selectedItem.locked) {
      return;
    }
    this.selectedWeapon = this.selectedItem.weaponType;
    this.selectedItem = this.weaponToItem(this.selectedWeapon);
    this.updateEquippedLine();
    this.refreshLoadout();
  }

  private refreshLoadout(): void {
    const weapon = getWeaponData(this.selectedWeapon);
    this.characterPreview.dataset.weapon = this.selectedWeapon;
    this.statGrid.replaceChildren(...this.makeStatRows(this.baseStats(weapon)));
    this.detailTitle.textContent = this.selectedItem.label;
    this.detailDescription.textContent = this.selectedItem.description;
    this.detailStats.replaceChildren(...this.makeStatRows(this.itemStats(this.selectedItem)));

    this.equipButton.disabled =
      this.selectedItem.locked ||
      this.selectedItem.weaponType === undefined ||
      this.selectedItem.weaponType === this.selectedWeapon;
    if (this.selectedItem.locked) {
      this.equipButton.textContent = "Locked";
    } else if (this.selectedItem.weaponType === this.selectedWeapon) {
      this.equipButton.textContent = "Equipped";
    } else {
      this.equipButton.textContent = "Equip";
    }

    for (const [weaponType, button] of this.weaponButtons) {
      const active = weaponType === this.selectedWeapon;
      button.classList.toggle("active", active);
    }

    const weaponSlot = this.slotButtons.get("weapon");
    if (weaponSlot) {
      weaponSlot.textContent = `Weapon: ${weapon.label}`;
      weaponSlot.classList.remove("locked");
    }
  }

  private makeStatRows(stats: Array<[string, string]>): HTMLElement[] {
    return stats.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      return [dt, dd];
    });
  }

  private baseStats(weapon: WeaponDefinition): Array<[string, string]> {
    return [
      ["Health", String(PLAYER_MAX_HEALTH)],
      ["Stamina", String(PLAYER_MAX_STAMINA)],
      ["Move Speed", String(MOVE_SPEED)],
      ["Weapon", weapon.label],
      ["Damage", String(weapon.damage)],
      ["Stamina Cost", String(weapon.staminaCost)],
      ["Attack Speed", `${this.attackSpeed(weapon)} / sec`],
      ["Range", String(weapon.range)],
      ["Guard Damage", String(weapon.guardDamage)],
      ["Stun", `${weapon.stun.toFixed(2)}s`],
    ];
  }

  private itemStats(item: LoadoutItem): Array<[string, string]> {
    if (!item.weaponType) {
      return [
        ["Status", item.locked ? "Locked" : "Available"],
        ["Season", "Future"],
      ];
    }
    const weapon = getWeaponData(item.weaponType);
    return [
      ["Damage", String(weapon.damage)],
      ["Stamina Cost", String(weapon.staminaCost)],
      ["Guard Damage", String(weapon.guardDamage)],
      ["Range", String(weapon.range)],
      ["Charge", `${weapon.chargeTime.toFixed(2)}s`],
      ["Attack Speed", `${this.attackSpeed(weapon)} / sec`],
      ["Recovery", `${weapon.timing.recovery.toFixed(2)}s`],
      ["Knockback", String(weapon.knockback)],
      ["Tracking", String(weapon.followSpeed)],
      ["Special", weapon.special],
    ];
  }

  private weaponToItem(weaponType: WeaponType): LoadoutItem {
    const weapon = getWeaponData(weaponType);
    return {
      id: weaponType,
      kind: "weapon",
      label: weapon.label,
      locked: false,
      weaponType,
      description: this.weaponDescription(weaponType),
    };
  }

  private weaponDescription(weaponType: WeaponType): string {
    if (weaponType === "longsword") {
      return "Balanced dueling weapon with average reach, cost, speed, and flexible cut/thrust motion.";
    }
    if (weaponType === "spear") {
      return "Long reach pressure weapon. Strong at distance, awkward up close, and focused on tip control.";
    }
    return "Heavy power weapon. Slow commitment, high damage, strong guard pressure, and heavy recovery.";
  }

  private attackSpeed(weapon: WeaponDefinition): string {
    const total = weapon.chargeTime + weapon.timing.windup + weapon.timing.active + weapon.timing.recovery;
    return (1 / total).toFixed(2);
  }

  private updateEquippedLine(): void {
    this.equippedLine.textContent = `Equipped: ${getWeaponData(this.selectedWeapon).label}`;
  }

  private openLoadout(): void {
    this.loadoutOverlay.classList.remove("hidden");
    this.refreshLoadout();
  }

  private closeLoadout(): void {
    this.loadoutOverlay.classList.add("hidden");
  }

  private makePart(className: string): HTMLDivElement {
    const part = document.createElement("div");
    part.className = className;
    return part;
  }

  private makeButton(text: string, variant: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${variant}`.trim();
    button.textContent = text;
    return button;
  }
}
