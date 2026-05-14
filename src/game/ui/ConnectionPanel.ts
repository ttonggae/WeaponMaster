type ConnectionPanelMode = "manual" | "friendly" | "matchmaking";

interface ConnectionCallbacks {
  onCreateOffer: () => Promise<string>;
  onCreateAnswer: (offer: string) => Promise<string>;
  onAcceptAnswer: (answer: string) => Promise<void>;
  onCreateRoom: () => Promise<string>;
  onJoinRoom: (code: string) => Promise<void>;
  onStartMatchmaking: () => Promise<void>;
  onCancelMatchmaking: () => Promise<void>;
  onBack: () => void;
}

export class ConnectionPanel {
  readonly root: HTMLElement;
  private readonly title = document.createElement("h2");
  private readonly status = document.createElement("div");
  private readonly localDescription = document.createElement("textarea");
  private readonly remoteOffer = document.createElement("textarea");
  private readonly remoteAnswer = document.createElement("textarea");
  private readonly roomCode = document.createElement("input");
  private readonly manualSection = document.createElement("div");
  private readonly friendlySection = document.createElement("div");
  private readonly matchmakingSection = document.createElement("div");
  private mode: ConnectionPanelMode = "manual";

  constructor(parent: HTMLElement, private readonly callbacks: ConnectionCallbacks) {
    this.root = document.createElement("aside");
    this.root.className = "connection-panel hidden";

    this.title.className = "panel-title";
    this.status.className = "status-line";
    this.status.textContent = "Offline";

    this.localDescription.placeholder = "Generated offer or answer appears here.";
    this.remoteOffer.placeholder = "Guest: paste host offer here, then create answer.";
    this.remoteAnswer.placeholder = "Host: paste guest answer here, then accept answer.";
    this.roomCode.placeholder = "ABC123";
    this.roomCode.maxLength = 6;
    this.roomCode.className = "weapon-select";

    const stack = document.createElement("div");
    stack.className = "stack";

    this.buildManualSection();
    this.buildFriendlySection();
    this.buildMatchmakingSection();

    const back = this.makeButton("Back To Menu", "ghost");
    back.addEventListener("click", () => this.callbacks.onBack());

    stack.append(
      this.title,
      this.status,
      this.matchmakingSection,
      this.friendlySection,
      this.manualSection,
      back,
    );
    this.root.append(stack);
    parent.append(this.root);
    this.setMode("manual");
  }

  setMode(mode: ConnectionPanelMode): void {
    this.mode = mode;
    this.applySectionVisibility(this.manualSection, mode === "manual");
    this.applySectionVisibility(this.friendlySection, mode === "friendly");
    this.applySectionVisibility(this.matchmakingSection, mode === "matchmaking");

    if (mode === "manual") {
      this.title.textContent = "Manual P2P";
      this.setStatus("Create an offer or paste an offer from the other player.");
    } else if (mode === "friendly") {
      this.title.textContent = "Friendly Match";
      this.setStatus("Create a room code or join with a 6-character code.");
    } else {
      this.title.textContent = "Online Matchmaking";
      this.setStatus("Start matchmaking to wait for an opponent.");
    }
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.root.hidden = false;
    this.root.style.display = "block";
    this.setMode(this.mode);
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.hidden = true;
    this.root.style.display = "none";
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setRemoteOffer(text: string): void {
    this.remoteOffer.value = text;
  }

  private buildManualSection(): void {
    this.manualSection.className = "stack panel-section";

    const createOffer = this.makeButton("Create Offer", "primary");
    createOffer.addEventListener("click", () => this.createOffer());

    const createAnswer = this.makeButton("Create Answer From Offer", "");
    createAnswer.addEventListener("click", () => this.createAnswer());

    const acceptAnswer = this.makeButton("Accept Answer", "");
    acceptAnswer.addEventListener("click", () => this.acceptAnswer());

    this.manualSection.append(
      createOffer,
      this.makeField("Local Description", this.localDescription),
      this.makeField("Remote Offer", this.remoteOffer),
      createAnswer,
      this.makeField("Remote Answer", this.remoteAnswer),
      acceptAnswer,
    );
  }

  private buildFriendlySection(): void {
    this.friendlySection.className = "stack panel-section";

    const createRoom = this.makeButton("Create Room", "primary");
    createRoom.addEventListener("click", () => this.createRoom());

    const joinRoom = this.makeButton("Join Room", "");
    joinRoom.addEventListener("click", () => this.joinRoom());

    this.friendlySection.append(
      this.makeInputField("6-character Room Code", this.roomCode),
      createRoom,
      joinRoom,
    );
  }

  private buildMatchmakingSection(): void {
    this.matchmakingSection.className = "stack panel-section";

    const matchmaking = this.makeButton("Start Matchmaking", "primary");
    matchmaking.addEventListener("click", () => this.startMatchmaking());

    const cancel = this.makeButton("Cancel Matching", "ghost");
    cancel.addEventListener("click", () => this.cancelMatchmaking());

    this.matchmakingSection.append(matchmaking, cancel);
  }

  private async createRoom(): Promise<void> {
    try {
      this.setStatus("Connecting to Firebase...");
      const code = await this.callbacks.onCreateRoom();
      this.roomCode.value = code;
      this.setStatus(`Room created: ${code}`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to create room.");
    }
  }

  private async joinRoom(): Promise<void> {
    try {
      this.setStatus("Joining room...");
      await this.callbacks.onJoinRoom(this.roomCode.value);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to join room.");
    }
  }

  private async startMatchmaking(): Promise<void> {
    try {
      this.setStatus("Waiting for opponent...");
      await this.callbacks.onStartMatchmaking();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to start matchmaking.");
    }
  }

  private async cancelMatchmaking(): Promise<void> {
    await this.callbacks.onCancelMatchmaking();
    this.setStatus("Offline");
  }

  private async createOffer(): Promise<void> {
    try {
      this.setStatus("Creating offer...");
      this.localDescription.value = await this.callbacks.onCreateOffer();
      this.setStatus("Offer ready. Send it to the guest.");
      this.localDescription.focus();
      this.localDescription.select();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to create offer.");
    }
  }

  private async createAnswer(): Promise<void> {
    try {
      this.setStatus("Creating answer...");
      this.localDescription.value = await this.callbacks.onCreateAnswer(this.remoteOffer.value);
      this.setStatus("Answer ready. Send it to the host.");
      this.localDescription.focus();
      this.localDescription.select();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to create answer.");
    }
  }

  private async acceptAnswer(): Promise<void> {
    try {
      this.setStatus("Accepting answer...");
      await this.callbacks.onAcceptAnswer(this.remoteAnswer.value);
      this.setStatus("Answer accepted. Waiting for DataChannel.");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Failed to accept answer.");
    }
  }

  private makeField(labelText: string, field: HTMLTextAreaElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "field-label";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, field);
    return label;
  }

  private makeInputField(labelText: string, field: HTMLInputElement): HTMLLabelElement {
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

  private applySectionVisibility(section: HTMLElement, visible: boolean): void {
    section.classList.toggle("hidden", !visible);
    section.hidden = !visible;
    section.setAttribute("aria-hidden", String(!visible));
    section.style.display = visible ? "grid" : "none";
  }
}
