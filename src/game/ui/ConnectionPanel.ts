import type { Language } from "../i18n/Localization";
import { t } from "../i18n/Localization";

interface ConnectionCallbacks {
  onCreateRoom: () => Promise<string>;
  onJoinRoom: (code: string) => Promise<void>;
  onBack: () => void;
}

export class ConnectionPanel {
  readonly root: HTMLElement;
  private language: Language;
  private readonly title = document.createElement("h2");
  private readonly status = document.createElement("div");
  private readonly roomCode = document.createElement("input");
  private readonly roomCodeLabel = document.createElement("span");
  private readonly createButton = document.createElement("button");
  private readonly joinButton = document.createElement("button");
  private readonly backButton = document.createElement("button");

  constructor(parent: HTMLElement, private readonly callbacks: ConnectionCallbacks, language: Language = "en") {
    this.language = language;
    this.root = document.createElement("aside");
    this.root.className = "connection-panel hidden";

    const stack = document.createElement("div");
    stack.className = "stack";

    this.title.className = "panel-title";

    this.status.className = "status-line";

    this.roomCode.placeholder = "ABC123";
    this.roomCode.maxLength = 6;
    this.roomCode.className = "weapon-select";

    this.createButton.className = "button primary";
    this.createButton.type = "button";
    this.createButton.addEventListener("click", () => this.createRoom());

    this.joinButton.className = "button";
    this.joinButton.type = "button";
    this.joinButton.addEventListener("click", () => this.joinRoom());

    this.backButton.className = "button ghost";
    this.backButton.type = "button";
    this.backButton.addEventListener("click", () => this.callbacks.onBack());

    stack.append(
      this.title,
      this.status,
      this.makeInputField(this.roomCode),
      this.createButton,
      this.joinButton,
      this.backButton,
    );
    this.root.append(stack);
    parent.append(this.root);
    this.setLanguage(this.language);
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.root.hidden = false;
    this.root.style.display = "block";
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.hidden = true;
    this.root.style.display = "none";
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.title.textContent = t(language, "friendlyMatch");
    this.roomCodeLabel.textContent = t(language, "roomCodeLabel");
    this.createButton.textContent = t(language, "createRoom");
    this.joinButton.textContent = t(language, "joinRoom");
    this.backButton.textContent = t(language, "backToMenu");
    if (!this.status.textContent) {
      this.status.textContent = t(language, "friendlyHelp");
    }
  }

  private async createRoom(): Promise<void> {
    try {
      this.setStatus(t(this.language, "creatingRoom"));
      const code = await this.callbacks.onCreateRoom();
      this.roomCode.value = code;
      this.setStatus(`${t(this.language, "roomCreated")}: ${code}`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : t(this.language, "createRoomFailed"));
    }
  }

  private async joinRoom(): Promise<void> {
    try {
      this.setStatus(t(this.language, "joiningRoom"));
      await this.callbacks.onJoinRoom(this.roomCode.value);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : t(this.language, "joinRoomFailed"));
    }
  }

  private makeInputField(field: HTMLInputElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "field-label";
    label.append(this.roomCodeLabel, field);
    return label;
  }
}
