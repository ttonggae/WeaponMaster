import type { Language } from "../i18n/Localization";
import { t } from "../i18n/Localization";

interface SettingsPanelCallbacks {
  initialVolume: number;
  initialLanguage: Language;
  onVolumeChange: (volumePercent: number) => void;
  onLanguageChange: (language: Language) => void;
}

export class SettingsPanel {
  readonly root: HTMLDivElement;
  private readonly toggleButton = document.createElement("button");
  private readonly controls = document.createElement("div");
  private readonly volumeValue = document.createElement("span");
  private readonly soundLabel = document.createElement("span");
  private readonly languageTitle = document.createElement("span");
  private readonly englishButton = document.createElement("button");
  private readonly koreanButton = document.createElement("button");
  private language: Language;

  constructor(parent: HTMLElement, callbacks: SettingsPanelCallbacks) {
    this.language = callbacks.initialLanguage;
    this.root = document.createElement("div");
    this.root.className = "settings-panel collapsed";

    this.toggleButton.type = "button";
    this.toggleButton.className = "button ghost settings-toggle";
    this.toggleButton.addEventListener("click", () => {
      this.root.classList.toggle("collapsed");
    });

    this.controls.className = "settings-controls";

    const volumeLabel = document.createElement("label");
    volumeLabel.className = "settings-field";

    const labelRow = document.createElement("span");
    labelRow.className = "settings-label-row";
    this.volumeValue.textContent = `${callbacks.initialVolume}%`;
    labelRow.append(this.soundLabel, this.volumeValue);

    const volumeInput = document.createElement("input");
    volumeInput.type = "range";
    volumeInput.min = "0";
    volumeInput.max = "100";
    volumeInput.step = "1";
    volumeInput.value = String(callbacks.initialVolume);
    volumeInput.addEventListener("input", () => {
      const value = Number(volumeInput.value);
      this.volumeValue.textContent = `${value}%`;
      callbacks.onVolumeChange(value);
    });

    volumeLabel.append(labelRow, volumeInput);

    const languageField = document.createElement("div");
    languageField.className = "settings-field";
    const languageOptions = document.createElement("div");
    languageOptions.className = "settings-segmented";

    this.englishButton.type = "button";
    this.englishButton.className = "settings-option";
    this.englishButton.addEventListener("click", () => {
      callbacks.onLanguageChange("en");
    });

    this.koreanButton.type = "button";
    this.koreanButton.className = "settings-option";
    this.koreanButton.addEventListener("click", () => {
      callbacks.onLanguageChange("ko");
    });

    languageOptions.append(this.englishButton, this.koreanButton);
    languageField.append(this.languageTitle, languageOptions);

    this.controls.append(volumeLabel, languageField);
    this.root.append(this.toggleButton, this.controls);
    parent.append(this.root);
    this.setLanguage(this.language);
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.toggleButton.textContent = t(language, "settings");
    this.soundLabel.textContent = t(language, "sound");
    this.languageTitle.textContent = t(language, "language");
    this.englishButton.textContent = t(language, "english");
    this.koreanButton.textContent = t(language, "korean");
    this.englishButton.classList.toggle("active", language === "en");
    this.koreanButton.classList.toggle("active", language === "ko");
  }
}
