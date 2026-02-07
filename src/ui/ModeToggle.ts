import { onEvent, emitEvent } from "../core/EventBus";

/**
 * ModeToggle - UI for switching between build and move modes.
 * Press Tab or click the button to toggle.
 */
export class ModeToggle {
  private container: HTMLDivElement;
  private button: HTMLButtonElement;
  private currentMode: "build" | "move" = "move";

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      font-family: monospace;
    `;

    this.button = document.createElement("button");
    this.button.style.cssText = `
      padding: 8px 20px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      border: 2px solid #fff;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    this.updateButton();

    this.button.addEventListener("click", () => this.toggle());
    this.container.appendChild(this.button);
    document.body.appendChild(this.container);

    // Listen for keyboard toggle (Tab key)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for mode changes from other sources
    onEvent<{ mode: "build" | "move" }>("mode:changed", ({ mode }) => {
      this.currentMode = mode;
      this.updateButton();
    });

    // Emit initial mode
    emitEvent("mode:changed", { mode: this.currentMode });
  }

  private toggle(): void {
    this.currentMode = this.currentMode === "build" ? "move" : "build";
    this.updateButton();
    emitEvent("mode:changed", { mode: this.currentMode });
  }

  private updateButton(): void {
    if (this.currentMode === "build") {
      this.button.textContent = "BUILD MODE (Tab)";
      this.button.style.background = "#ff6600";
      this.button.style.color = "#fff";
    } else {
      this.button.textContent = "MOVE MODE (Tab)";
      this.button.style.background = "#0088ff";
      this.button.style.color = "#fff";
    }
  }
}
