import { emitEvent } from "../core/EventBus";

/**
 * Debug toggle buttons for development
 */
export class DebugToggle {
  private container: HTMLDivElement;
  private gridButton: HTMLButtonElement;
  private blocksButton: HTMLButtonElement;
  private gridOn = false;
  private blocksHidden = false;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Grid toggle button
    this.gridButton = this.createButton("Show Grid");
    this.gridButton.addEventListener("click", () => {
      this.gridOn = !this.gridOn;
      this.gridButton.textContent = this.gridOn ? "Hide Grid" : "Show Grid";
      this.gridButton.style.background = this.gridOn ? "#0066cc" : "#333";
      emitEvent("debug:toggle-grid", {});
    });

    // Blocks toggle button
    this.blocksButton = this.createButton("Hide Blocks");
    this.blocksButton.addEventListener("click", () => {
      this.blocksHidden = !this.blocksHidden;
      this.blocksButton.textContent = this.blocksHidden ? "Show Blocks" : "Hide Blocks";
      this.blocksButton.style.background = this.blocksHidden ? "#cc6600" : "#333";
      emitEvent("debug:toggle-blocks", { hidden: this.blocksHidden });
    });

    this.container.appendChild(this.gridButton);
    this.container.appendChild(this.blocksButton);
    document.body.appendChild(this.container);
  }

  private createButton(text: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      padding: 8px 16px;
      font-size: 14px;
      background: #333;
      color: white;
      border: 1px solid #666;
      border-radius: 4px;
      cursor: pointer;
      min-width: 120px;
    `;
    return button;
  }
}
