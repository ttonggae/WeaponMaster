import {
  CURRENT_SEASON_NAME,
  CURRENT_SEASON_NUMBER,
  MOVE_SPEED,
  PLAYER_MAX_HEALTH,
  PLAYER_MAX_STAMINA,
} from "../constants";
import type { Language } from "../i18n/Localization";
import { specialLabel, t, weaponDescription, weaponLabel } from "../i18n/Localization";
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
    label: "Usable Gear",
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
  private language: Language = "en";
  private selectedWeapon: WeaponType = "longsword";
  private selectedCategory: LoadoutItemKind = "weapon";
  private selectedItem: LoadoutItem = this.weaponToItem("longsword");
  private signedInName: string | null = null;
  private accountStatusText: string | null = null;
  private currentScore: LeaderboardEntry | null = null;
  private leaderboardEntries: LeaderboardEntry[] = [];
  private readonly seasonBadge = document.createElement("div");
  private readonly subtitle = document.createElement("p");
  private readonly leaderboardTitle = document.createElement("h2");
  private readonly loadoutButton = document.createElement("button");
  private readonly rankedButton = document.createElement("button");
  private readonly casualButton = document.createElement("button");
  private readonly friendlyButton = document.createElement("button");
  private readonly loadoutHeading = document.createElement("h2");
  private readonly loadoutNote = document.createElement("p");
  private readonly closeButton = document.createElement("button");
  private readonly statTitle = document.createElement("h3");
  private readonly categoryHeading = document.createElement("h3");
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
  private readonly categoryList = document.createElement("div");
  private readonly itemList = document.createElement("div");
  private readonly selectionTitle = document.createElement("h3");
  private readonly weaponButtons = new Map<WeaponType, HTMLButtonElement>();
  private readonly categoryButtons = new Map<LoadoutItemKind, HTMLButtonElement>();

  constructor(parent: HTMLElement, callbacks: MenuCallbacks, language: Language = "en") {
    this.language = language;
    this.root = document.createElement("div");
    this.root.className = "menu-shell";

    const panel = document.createElement("div");
    panel.className = "menu-panel";

    const titleBlock = document.createElement("section");
    titleBlock.className = "menu-title-block";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "WeaponMaster";

    this.seasonBadge.className = "season-badge";

    this.subtitle.className = "menu-subtitle";

    this.accountLine.className = "account-line";
    titleBlock.append(title, this.seasonBadge, this.subtitle, this.accountLine);

    const rankPanel = document.createElement("section");
    rankPanel.className = "leaderboard-panel";
    this.leaderboardList.className = "leaderboard-list";
    this.scoreLine.className = "score-line";
    rankPanel.append(this.leaderboardTitle, this.leaderboardList, this.scoreLine);

    const matchPanel = document.createElement("section");
    matchPanel.className = "match-menu-panel";

    this.equippedLine.className = "equipped-line";
    this.updateEquippedLine();

    this.loadoutButton.className = "button secondary";
    this.loadoutButton.type = "button";
    this.loadoutButton.addEventListener("click", () => this.openLoadout());

    const actionGrid = document.createElement("div");
    actionGrid.className = "menu-actions";
    this.rankedButton.className = "button primary";
    this.rankedButton.type = "button";
    this.rankedButton.addEventListener("click", () => {
      callbacks.onStartRanked(this.selectedWeapon);
    });

    this.casualButton.className = "button";
    this.casualButton.type = "button";
    this.casualButton.addEventListener("click", () => {
      callbacks.onStartCasual(this.selectedWeapon);
    });

    this.friendlyButton.className = "button";
    this.friendlyButton.type = "button";
    this.friendlyButton.addEventListener("click", () => {
      callbacks.onOpenFriendly(this.selectedWeapon);
    });

    actionGrid.append(this.rankedButton, this.casualButton, this.friendlyButton);
    matchPanel.append(this.loadoutButton, this.equippedLine, actionGrid);

    panel.append(titleBlock, rankPanel, matchPanel);
    this.root.append(panel, this.buildLoadoutOverlay());
    parent.append(this.root);
    this.applyLanguage();
    this.renderAccountLine();
    this.setPlayerScore(null);
    const loading = document.createElement("li");
    loading.textContent = t(this.language, "loadingRankings");
    this.leaderboardList.replaceChildren(loading);
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
    this.signedInName = name;
    this.accountStatusText = null;
    this.renderAccountLine();
  }

  setAccountStatus(text: string): void {
    this.signedInName = null;
    this.accountStatusText = text;
    this.accountLine.textContent = text;
  }

  setPlayerScore(entry: LeaderboardEntry | null): void {
    this.currentScore = entry;
    if (!entry) {
      this.scoreLine.textContent = t(this.language, "scoreNotSignedIn");
      return;
    }
    this.scoreLine.textContent = `${t(this.language, "scoreLabel")}: ${entry.score} (${entry.wins}${t(this.language, "winsShort")}/${entry.losses}${t(this.language, "lossesShort")})`;
  }

  setLeaderboard(entries: LeaderboardEntry[]): void {
    this.leaderboardEntries = entries;
    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = t(this.language, "noRankRecords");
      this.leaderboardList.replaceChildren(empty);
      return;
    }

    this.leaderboardList.replaceChildren(
      ...entries.map((entry) => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        const score = document.createElement("strong");
        name.textContent = `${entry.displayName} (${entry.wins}${t(this.language, "winsShort")}/${entry.losses}${t(this.language, "lossesShort")})`;
        score.textContent = String(entry.score);
        item.append(name, score);
        return item;
      }),
    );
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.selectedItem = this.selectedItem.weaponType
      ? this.weaponToItem(this.selectedItem.weaponType)
      : this.lockedItemFor(this.selectedCategory);
    this.applyLanguage();
    this.refreshLoadout();
    this.renderAccountLine();
    this.setPlayerScore(this.currentScore);
    this.setLeaderboard(this.leaderboardEntries);
  }

  private applyLanguage(): void {
    this.seasonBadge.textContent = `${t(this.language, "season")} ${CURRENT_SEASON_NUMBER}: ${CURRENT_SEASON_NAME}`;
    this.subtitle.textContent = t(this.language, "subtitle");
    this.leaderboardTitle.textContent = t(this.language, "top10");
    this.loadoutButton.textContent = t(this.language, "loadout");
    this.rankedButton.textContent = t(this.language, "rankedMatch");
    this.casualButton.textContent = t(this.language, "casualMatch");
    this.friendlyButton.textContent = t(this.language, "friendlyMatch");
    this.loadoutHeading.textContent = t(this.language, "loadout");
    this.loadoutNote.textContent = t(this.language, "loadoutNote");
    this.closeButton.textContent = t(this.language, "close");
    this.statTitle.textContent = t(this.language, "currentStats");
    this.categoryHeading.textContent = t(this.language, "equipmentType");
    this.updateEquippedLine();
  }

  private renderAccountLine(): void {
    if (this.signedInName) {
      this.accountLine.textContent = `${t(this.language, "signedInAs")} ${this.signedInName}`;
      return;
    }
    this.accountLine.textContent = this.accountStatusText ?? t(this.language, "accountAuto");
  }

  private buildLoadoutOverlay(): HTMLElement {
    this.loadoutOverlay.className = "loadout-overlay hidden";

    const modal = document.createElement("section");
    modal.className = "loadout-modal";

    const header = document.createElement("header");
    header.className = "loadout-header";
    const title = document.createElement("div");
    title.append(this.loadoutHeading, this.loadoutNote);
    this.closeButton.type = "button";
    this.closeButton.className = "button ghost";
    this.closeButton.addEventListener("click", () => this.closeLoadout());
    header.append(title, this.closeButton);

    const body = document.createElement("div");
    body.className = "loadout-body";

    const characterPanel = document.createElement("section");
    characterPanel.className = "loadout-character-panel";

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
    this.statGrid.className = "stat-grid";
    statPanel.append(this.statTitle, this.statGrid);
    characterPanel.append(this.characterPreview, statPanel);

    const categoryPanel = document.createElement("section");
    categoryPanel.className = "loadout-categories";
    this.categoryList.className = "category-list";
    categoryPanel.append(this.categoryHeading, this.categoryList);
    this.buildCategoryButtons();

    const selectionPanel = document.createElement("section");
    selectionPanel.className = "loadout-selection";
    this.selectionTitle.textContent = "Weapon";
    this.itemList.className = "inventory-list";
    selectionPanel.append(this.selectionTitle, this.itemList);

    const details = document.createElement("section");
    details.className = "loadout-details";
    this.detailTitle.textContent = "";
    this.detailDescription.textContent = "";
    this.detailStats.className = "stat-grid detail";
    this.equipButton.type = "button";
    this.equipButton.className = "button primary";
    this.equipButton.addEventListener("click", () => this.equipSelectedItem());
    details.append(this.detailTitle, this.detailDescription, this.detailStats, this.equipButton);

    body.append(characterPanel, categoryPanel, selectionPanel, details);
    modal.append(header, body);
    this.loadoutOverlay.append(modal);
    return this.loadoutOverlay;
  }

  private buildCategoryButtons(): void {
    const categories: LoadoutItemKind[] = ["weapon", "gear", "armor", "passive"];

    this.categoryList.replaceChildren(
      ...categories.map((kind) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-button";
        button.textContent = this.categoryTitle(kind);
        button.addEventListener("click", () => this.selectCategory(kind));
        this.categoryButtons.set(kind, button);
        return button;
      }),
    );
  }

  private makeInventoryButton(item: LoadoutItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-item ${item.locked ? "locked" : ""}`;
    button.classList.toggle("selected", item.id === this.selectedItem.id);
    const type = document.createElement("span");
    const name = document.createElement("strong");
    type.textContent = this.categoryTitle(item.kind);
    name.textContent = item.label;
    button.append(type, name);
    button.addEventListener("click", () => this.selectItem(item));
    return button;
  }

  private selectCategory(category: LoadoutItemKind): void {
    this.selectedCategory = category;
    this.selectedItem = category === "weapon" ? this.weaponToItem(this.selectedWeapon) : this.lockedItemFor(category);
    this.refreshLoadout();
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
    this.refreshCategoryState();
    this.refreshItemList();
    this.detailTitle.textContent = this.selectedItem.label;
    this.detailDescription.textContent = this.selectedItem.description;
    this.detailStats.replaceChildren(...this.makeStatRows(this.itemStats(this.selectedItem)));

    this.equipButton.disabled =
      this.selectedItem.locked ||
      this.selectedItem.weaponType === undefined ||
      this.selectedItem.weaponType === this.selectedWeapon;
    if (this.selectedItem.locked) {
      this.equipButton.textContent = t(this.language, "locked");
    } else if (this.selectedItem.weaponType === this.selectedWeapon) {
      this.equipButton.textContent = t(this.language, "equipped");
    } else {
      this.equipButton.textContent = t(this.language, "equip");
    }

    for (const [weaponType, button] of this.weaponButtons) {
      const active = weaponType === this.selectedWeapon;
      button.classList.toggle("active", active);
    }
  }

  private refreshCategoryState(): void {
    const labels: Record<LoadoutItemKind, string> = {
      weapon: `${t(this.language, "weapon")}: ${weaponLabel(this.selectedWeapon, this.language)}`,
      gear: `${t(this.language, "usableGear")}: ${t(this.language, "locked")}`,
      armor: `${t(this.language, "armor")}: ${t(this.language, "locked")}`,
      passive: `${t(this.language, "passive")}: ${t(this.language, "locked")}`,
    };
    this.categoryButtons.forEach((button, category) => {
      button.textContent = labels[category];
      button.classList.toggle("active", category === this.selectedCategory);
      button.classList.toggle("locked", category !== "weapon");
    });
  }

  private refreshItemList(): void {
    this.weaponButtons.clear();
    this.selectionTitle.textContent = this.categoryTitle(this.selectedCategory);
    if (this.selectedCategory === "weapon") {
      const buttons = WEAPON_TYPES.map((weaponType) => {
        const item = this.weaponToItem(weaponType);
        const button = this.makeInventoryButton(item);
        this.weaponButtons.set(weaponType, button);
        return button;
      });
      this.itemList.replaceChildren(...buttons);
      return;
    }

    this.itemList.replaceChildren(this.makeInventoryButton(this.lockedItemFor(this.selectedCategory)));
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
      [t(this.language, "health"), String(PLAYER_MAX_HEALTH)],
      [t(this.language, "stamina"), String(PLAYER_MAX_STAMINA)],
      [t(this.language, "moveSpeed"), String(MOVE_SPEED)],
      [t(this.language, "weapon"), weaponLabel(weapon.type, this.language)],
      [t(this.language, "damage"), String(weapon.damage)],
      [t(this.language, "staminaCost"), String(weapon.staminaCost)],
      [t(this.language, "attackSpeed"), `${this.attackSpeed(weapon)} / sec`],
      [t(this.language, "range"), String(weapon.range)],
      [t(this.language, "guardDamage"), String(weapon.guardDamage)],
      [t(this.language, "stun"), `${weapon.stun.toFixed(2)}s`],
    ];
  }

  private itemStats(item: LoadoutItem): Array<[string, string]> {
    if (!item.weaponType) {
      return [
        [t(this.language, "status"), item.locked ? t(this.language, "locked") : t(this.language, "available")],
        [t(this.language, "seasonLabel"), t(this.language, "future")],
      ];
    }
    const weapon = getWeaponData(item.weaponType);
    return [
      [t(this.language, "damage"), String(weapon.damage)],
      [t(this.language, "staminaCost"), String(weapon.staminaCost)],
      [t(this.language, "guardDamage"), String(weapon.guardDamage)],
      [t(this.language, "range"), String(weapon.range)],
      [t(this.language, "charge"), `${weapon.chargeTime.toFixed(2)}s`],
      [t(this.language, "attackSpeed"), `${this.attackSpeed(weapon)} / sec`],
      [t(this.language, "recovery"), `${weapon.timing.recovery.toFixed(2)}s`],
      [t(this.language, "knockback"), String(weapon.knockback)],
      [t(this.language, "tracking"), String(weapon.followSpeed)],
      [t(this.language, "special"), specialLabel(weapon.special, this.language)],
    ];
  }

  private weaponToItem(weaponType: WeaponType): LoadoutItem {
    return {
      id: weaponType,
      kind: "weapon",
      label: weaponLabel(weaponType, this.language),
      locked: false,
      weaponType,
      description: weaponDescription(weaponType, this.language),
    };
  }

  private lockedItemFor(category: LoadoutItemKind): LoadoutItem {
    if (category === "weapon") {
      return this.weaponToItem(this.selectedWeapon);
    }
    const labels: Record<Exclude<LoadoutItemKind, "weapon">, string> = {
      gear: t(this.language, "usableGear"),
      armor: t(this.language, "armor"),
      passive: t(this.language, "passive"),
    };
    const descriptions: Record<Exclude<LoadoutItemKind, "weapon">, string> = {
      gear:
        this.language === "ko"
          ? "사용 장비와 소모품 슬롯은 추후 업데이트에서 해금됩니다."
          : "Equipment and consumable utility slots are reserved for a future update.",
      armor:
        this.language === "ko"
          ? "갑옷은 이후 방어력, 기력 압박, 이동 무게를 조정하게 됩니다."
          : "Armor will later modify protection, stamina pressure, and movement weight.",
      passive:
        this.language === "ko"
          ? "패시브 특성은 시즌 빌드와 무기 전문화를 결정하게 됩니다."
          : "Passive traits will later define season builds and weapon specializations.",
    };
    const lockedCategory = category as Exclude<LoadoutItemKind, "weapon">;
    const fallback = LOCKED_ITEMS.find((item) => item.kind === category) ?? LOCKED_ITEMS[0];
    return {
      ...fallback,
      label: labels[lockedCategory],
      description: descriptions[lockedCategory],
    };
  }

  private categoryTitle(category: LoadoutItemKind): string {
    if (category === "weapon") {
      return t(this.language, "weaponSelection");
    }
    if (category === "gear") {
      return t(this.language, "usableGear");
    }
    if (category === "armor") {
      return t(this.language, "armor");
    }
    return t(this.language, "passive");
  }

  private attackSpeed(weapon: WeaponDefinition): string {
    const total = weapon.chargeTime + weapon.timing.windup + weapon.timing.active + weapon.timing.recovery;
    return (1 / total).toFixed(2);
  }

  private updateEquippedLine(): void {
    this.equippedLine.textContent = `${t(this.language, "equipped")}: ${weaponLabel(this.selectedWeapon, this.language)}`;
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
