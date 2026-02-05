export class InputManager {
  private readonly keysPressed = new Set<string>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    globalThis.addEventListener("keydown", (event) => {
      this.keysPressed.add(event.key.toLowerCase());
    });

    globalThis.addEventListener("keyup", (event) => {
      this.keysPressed.delete(event.key.toLowerCase());
    });

    // Clear keys when window loses focus (prevents stuck keys)
    globalThis.addEventListener("blur", () => {
      this.keysPressed.clear();
    });
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  // Check if ANY of the given keys are pressed
  isAnyKeyPressed(...keys: string[]): boolean {
    return keys.some(key => this.isKeyPressed(key));
  }
}