import type { Language } from "../i18n/Localization";
import { t } from "../i18n/Localization";

interface MatchOverlayCallbacks {
  onCancel: () => Promise<void>;
}

export class MatchOverlay {
  readonly root: HTMLElement;
  private readonly title = document.createElement("h2");
  private readonly detail = document.createElement("p");
  private readonly cancelButton = document.createElement("button");
  private cancelable = true;
  private language: Language;

  constructor(parent: HTMLElement, private readonly callbacks: MatchOverlayCallbacks, language: Language = "en") {
    this.language = language;
    this.root = document.createElement("aside");
    this.root.className = "match-overlay hidden";

    const panel = document.createElement("div");
    panel.className = "match-overlay-panel";

    this.title.textContent = this.defaultTitle();
    this.detail.textContent = this.defaultDetail();

    this.cancelButton.type = "button";
    this.cancelButton.className = "button ghost";
    this.cancelButton.addEventListener("click", () => {
      void this.cancel();
    });

    panel.append(this.title, this.detail, this.cancelButton);
    this.root.append(panel);
    parent.append(this.root);
    this.setLanguage(language);
  }

  show(title = this.defaultTitle(), detail = this.defaultDetail(), cancelable = true): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    this.setCancelable(cancelable);
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  setDetail(text: string): void {
    this.detail.textContent = text;
  }

  setCancelable(cancelable: boolean): void {
    this.cancelable = cancelable;
    this.cancelButton.disabled = !cancelable;
    this.cancelButton.hidden = !cancelable;
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.cancelButton.textContent = t(language, "cancel");
  }

  private defaultTitle(): string {
    return t(this.language, "matching");
  }

  private defaultDetail(): string {
    return t(this.language, "findingOpponent");
  }

  private async cancel(): Promise<void> {
    if (!this.cancelable) {
      return;
    }
    await this.callbacks.onCancel();
    this.hide();
  }
}
