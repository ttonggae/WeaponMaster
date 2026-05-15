interface SettingsPanelCallbacks {
  initialVolume: number;
  onVolumeChange: (volumePercent: number) => void;
}

export class SettingsPanel {
  readonly root: HTMLDivElement;
  private readonly toggleButton = document.createElement("button");
  private readonly controls = document.createElement("div");
  private readonly volumeValue = document.createElement("span");

  constructor(parent: HTMLElement, callbacks: SettingsPanelCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "settings-panel collapsed";

    this.toggleButton.type = "button";
    this.toggleButton.className = "button ghost settings-toggle";
    this.toggleButton.textContent = "Settings";
    this.toggleButton.addEventListener("click", () => {
      this.root.classList.toggle("collapsed");
    });

    this.controls.className = "settings-controls";

    const volumeLabel = document.createElement("label");
    volumeLabel.className = "settings-field";

    const labelRow = document.createElement("span");
    labelRow.className = "settings-label-row";
    const labelText = document.createElement("span");
    labelText.textContent = "Sound";
    this.volumeValue.textContent = `${callbacks.initialVolume}%`;
    labelRow.append(labelText, this.volumeValue);

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
    this.controls.append(volumeLabel);
    this.root.append(this.toggleButton, this.controls);
    parent.append(this.root);
  }
}
