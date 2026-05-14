interface ConnectionCallbacks {
  onCreateRoom: () => Promise<string>;
  onJoinRoom: (code: string) => Promise<void>;
  onBack: () => void;
}

export class ConnectionPanel {
  readonly root: HTMLElement;
  private readonly status = document.createElement("div");
  private readonly roomCode = document.createElement("input");

  constructor(parent: HTMLElement, private readonly callbacks: ConnectionCallbacks) {
    this.root = document.createElement("aside");
    this.root.className = "connection-panel hidden";

    const stack = document.createElement("div");
    stack.className = "stack";

    const title = document.createElement("h2");
    title.className = "panel-title";
    title.textContent = "Friendly Match";

    this.status.className = "status-line";
    this.status.textContent = "Create a room code or join with a 6-character code.";

    this.roomCode.placeholder = "ABC123";
    this.roomCode.maxLength = 6;
    this.roomCode.className = "weapon-select";

    const createRoom = this.makeButton("Create Room", "primary");
    createRoom.addEventListener("click", () => this.createRoom());

    const joinRoom = this.makeButton("Join Room", "");
    joinRoom.addEventListener("click", () => this.joinRoom());

    const back = this.makeButton("Back To Menu", "ghost");
    back.addEventListener("click", () => this.callbacks.onBack());

    stack.append(
      title,
      this.status,
      this.makeInputField("6-character Room Code", this.roomCode),
      createRoom,
      joinRoom,
      back,
    );
    this.root.append(stack);
    parent.append(this.root);
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

  private async createRoom(): Promise<void> {
    try {
      this.setStatus("Creating room...");
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
}
