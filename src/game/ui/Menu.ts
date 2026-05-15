import { CURRENT_SEASON_NAME, CURRENT_SEASON_NUMBER } from "../constants";
import type { LeaderboardEntry, WeaponType } from "../types";
import { WeaponSelect } from "./WeaponSelect";

interface MenuCallbacks {
  onStartRanked: (localWeapon: WeaponType) => void;
  onStartCasual: (localWeapon: WeaponType) => void;
  onOpenFriendly: (localWeapon: WeaponType) => void;
}

export class Menu {
  readonly root: HTMLDivElement;
  private readonly weaponSelect = new WeaponSelect("longsword");
  private readonly accountLine = document.createElement("div");
  private readonly scoreLine = document.createElement("div");
  private readonly leaderboardList = document.createElement("ol");

  constructor(parent: HTMLElement, callbacks: MenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "menu-shell";

    const panel = document.createElement("div");
    panel.className = "menu-panel";

    const hero = document.createElement("section");
    hero.className = "menu-hero";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "WeaponMaster";

    const season = document.createElement("div");
    season.className = "season-badge";
    season.textContent = `Season ${CURRENT_SEASON_NUMBER}: ${CURRENT_SEASON_NAME}`;

    const subtitle = document.createElement("p");
    subtitle.className = "menu-subtitle";
    subtitle.textContent =
      "Heavy 1v1 medieval duel. Ranked and casual matching use Google sign-in for identity.";

    this.accountLine.className = "account-line";
    this.accountLine.textContent = "Google sign-in is restored automatically after the first login.";
    this.scoreLine.className = "score-line";
    this.scoreLine.textContent = "Score: not signed in";

    const side = document.createElement("section");
    side.className = "menu-side";

    const controls = document.createElement("div");
    controls.className = "menu-controls-panel";

    const grid = document.createElement("div");
    grid.className = "menu-grid single";
    grid.append(this.makeField("Your Weapon", this.weaponSelect.element));

    const actions = document.createElement("div");
    actions.className = "menu-actions";

    const rankedButton = this.makeButton("Ranked Match", "primary");
    rankedButton.addEventListener("click", () => {
      callbacks.onStartRanked(this.weaponSelect.value);
    });

    const casualButton = this.makeButton("Casual Match", "");
    casualButton.addEventListener("click", () => {
      callbacks.onStartCasual(this.weaponSelect.value);
    });

    const friendlyButton = this.makeButton("Friendly Match", "");
    friendlyButton.addEventListener("click", () => {
      callbacks.onOpenFriendly(this.weaponSelect.value);
    });

    const leaderboard = document.createElement("section");
    leaderboard.className = "leaderboard-panel";
    const leaderboardTitle = document.createElement("h2");
    leaderboardTitle.textContent = "Season Top 10";
    this.leaderboardList.className = "leaderboard-list";
    this.leaderboardList.innerHTML = "<li>Loading rankings...</li>";
    leaderboard.append(leaderboardTitle, this.leaderboardList);

    actions.append(rankedButton, casualButton, friendlyButton);
    controls.append(grid, actions);
    hero.append(title, season, subtitle, this.accountLine, this.scoreLine);
    side.append(controls, leaderboard);
    panel.append(hero, side);
    this.root.append(panel);
    parent.append(this.root);
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
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
      this.scoreLine.textContent = "Score: not signed in";
      return;
    }
    this.scoreLine.textContent = `Score: ${entry.score} (${entry.wins}W/${entry.losses}L)`;
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
