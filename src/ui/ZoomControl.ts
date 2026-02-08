import { emitEvent } from "../core/EventBus";

/**
 * Zoom control slider for camera
 */
export class ZoomControl {
  private container: HTMLDivElement;
  private slider: HTMLInputElement;
  private label: HTMLSpanElement;

  constructor(initialZoom = 10, minZoom = 5, maxZoom = 30) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.7);
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #444;
    `;

    // Label
    this.label = document.createElement("span");
    this.label.style.cssText = `
      color: white;
      font-size: 12px;
      font-family: monospace;
    `;
    this.label.textContent = `Zoom: ${initialZoom}`;

    // Slider
    this.slider = document.createElement("input");
    this.slider.type = "range";
    this.slider.min = String(minZoom);
    this.slider.max = String(maxZoom);
    this.slider.value = String(initialZoom);
    this.slider.step = "1";
    this.slider.style.cssText = `
      width: 120px;
      cursor: pointer;
      accent-color: #0088ff;
    `;

    this.slider.addEventListener("input", () => {
      const zoom = parseInt(this.slider.value, 10);
      this.label.textContent = `Zoom: ${zoom}`;
      emitEvent("camera:zoom", { zoom });
    });

    // Zoom buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    const zoomInBtn = this.createButton("+");
    zoomInBtn.addEventListener("click", () => {
      const newZoom = Math.max(minZoom, parseInt(this.slider.value, 10) - 2);
      this.slider.value = String(newZoom);
      this.label.textContent = `Zoom: ${newZoom}`;
      emitEvent("camera:zoom", { zoom: newZoom });
    });

    const zoomOutBtn = this.createButton("-");
    zoomOutBtn.addEventListener("click", () => {
      const newZoom = Math.min(maxZoom, parseInt(this.slider.value, 10) + 2);
      this.slider.value = String(newZoom);
      this.label.textContent = `Zoom: ${newZoom}`;
      emitEvent("camera:zoom", { zoom: newZoom });
    });

    buttonContainer.appendChild(zoomInBtn);
    buttonContainer.appendChild(zoomOutBtn);

    this.container.appendChild(this.label);
    this.container.appendChild(this.slider);
    this.container.appendChild(buttonContainer);
    document.body.appendChild(this.container);
  }

  private createButton(text: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      width: 32px;
      height: 32px;
      font-size: 18px;
      font-weight: bold;
      background: #333;
      color: white;
      border: 1px solid #666;
      border-radius: 4px;
      cursor: pointer;
    `;
    return button;
  }
}
