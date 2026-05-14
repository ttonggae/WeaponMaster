interface MatchOverlayCallbacks {
  onCancel: () => Promise<void>;
}

export class MatchOverlay {
  readonly root: HTMLElement;
  private readonly title = document.createElement("h2");
  private readonly detail = document.createElement("p");
  private readonly defaultTitle = "\uB9E4\uCE6D \uC7A1\uB294\uC911...";
  private readonly defaultDetail = "\uC0C1\uB300\uB97C \uCC3E\uB294 \uC911\uC785\uB2C8\uB2E4.";

  constructor(parent: HTMLElement, private readonly callbacks: MatchOverlayCallbacks) {
    this.root = document.createElement("aside");
    this.root.className = "match-overlay hidden";

    const panel = document.createElement("div");
    panel.className = "match-overlay-panel";

    this.title.textContent = this.defaultTitle;
    this.detail.textContent = this.defaultDetail;

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      void this.cancel();
    });

    panel.append(this.title, this.detail, cancel);
    this.root.append(panel);
    parent.append(this.root);
  }

  show(title = this.defaultTitle, detail = this.defaultDetail): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  setDetail(text: string): void {
    this.detail.textContent = text;
  }

  private async cancel(): Promise<void> {
    await this.callbacks.onCancel();
    this.hide();
  }
}
