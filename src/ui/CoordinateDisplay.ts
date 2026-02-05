import { onEvent } from "../core/EventBus";

/**
 * CoordinateDisplay - Shows the coordinates of the hovered block
 */
export class CoordinateDisplay {
  private readonly element: HTMLDivElement;

  constructor() {
    // Create UI element
    this.element = document.createElement("div");
    this.element.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ffff;
      padding: 10px 15px;
      font-family: monospace;
      font-size: 14px;
      border-radius: 4px;
      display: none;
    `;
    document.body.appendChild(this.element);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    onEvent<{ x: number; y: number; z: number }>("block:hovered", ({ x, y, z }) => {
      this.element.textContent = `Block: (${x}, ${y}, ${z})`;
      this.element.style.display = "block";
    });

    onEvent("block:unhovered", () => {
      this.element.style.display = "none";
    });
  }

  dispose(): void {
    this.element.remove();
  }
}