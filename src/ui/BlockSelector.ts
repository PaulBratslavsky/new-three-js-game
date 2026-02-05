import { BLOCK_TYPES } from "../structures/BlockTypes";
import { emitEvent, onEvent } from "../core/EventBus";

/**
 * BlockSelector - UI for choosing block type
 * Press 1-5 to select different block types
 */
export class BlockSelector {
  private readonly element: HTMLDivElement;
  private selectedIndex: number = 0;

  constructor() {
    this.element = document.createElement("div");
    this.element.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
    `;
    document.body.appendChild(this.element);

    this.createButtons();
    this.setupEventListeners();
    this.updateSelection();
  }

  private createButtons(): void {
    BLOCK_TYPES.forEach((blockType, index) => {
      const button = document.createElement("div");
      button.style.cssText = `
        width: 50px;
        height: 50px;
        background: #${blockType.color.toString(16).padStart(6, "0")};
        border: 3px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 18px;
        font-weight: bold;
        color: white;
        text-shadow: 1px 1px 2px black;
      `;
      button.textContent = `${index + 1}`;
      button.dataset.index = index.toString();

      button.addEventListener("click", () => {
        this.selectBlock(index);
      });

      this.element.appendChild(button);
    });
  }

  private setupEventListeners(): void {
    // Number keys 1-5 to select blocks
    globalThis.addEventListener("keydown", (event) => {
      const num = parseInt(event.key);
      if (num >= 1 && num <= BLOCK_TYPES.length) {
        this.selectBlock(num - 1);
      }
    });

    // Listen for external type changes
    onEvent<{ type: string }>("block:type-changed", ({ type }) => {
      const index = BLOCK_TYPES.findIndex((b) => b.id === type);
      if (index !== -1 && index !== this.selectedIndex) {
        this.selectedIndex = index;
        this.updateSelection();
      }
    });
  }

  private selectBlock(index: number): void {
    if (index >= 0 && index < BLOCK_TYPES.length) {
      this.selectedIndex = index;
      this.updateSelection();

      // Emit event for PlacementSystem
      emitEvent("block:select", { type: BLOCK_TYPES[index].id });
    }
  }

  private updateSelection(): void {
    const buttons = this.element.children;
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLDivElement;
      button.style.borderColor =
        i === this.selectedIndex ? "#00ffff" : "transparent";
      button.style.transform =
        i === this.selectedIndex ? "scale(1.1)" : "scale(1)";
    }
  }

  dispose(): void {
    this.element.remove();
  }
}
