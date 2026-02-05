/**
 * EventBus - Simple pub/sub for loose coupling between systems
 *
 * Usage:
 *   emitEvent("player:moved", { x: 10, z: 20 });
 *   onEvent("player:moved", (data) => console.log(data.x));
 *   offEvent("player:moved", handler);
 */

type EventHandler<T = unknown> = (data: T) => void;

// Store all event handlers
const handlers: Map<string, Set<EventHandler>> = new Map();

/**
 * Subscribe to an event
 */
export function onEvent<T>(event: string, handler: EventHandler<T>): void {
  if (!handlers.has(event)) {
    handlers.set(event, new Set());
  }
  handlers.get(event)!.add(handler as EventHandler);
}

/**
 * Unsubscribe from an event
 */
export function offEvent<T>(event: string, handler: EventHandler<T>): void {
  const eventHandlers = handlers.get(event);
  if (eventHandlers) {
    eventHandlers.delete(handler as EventHandler);
  }
}

/**
 * Emit an event to all subscribers
 */
export function emitEvent<T>(event: string, data: T): void {
  const eventHandlers = handlers.get(event);
  if (eventHandlers) {
    eventHandlers.forEach(handler => handler(data));
  }
}

/**
 * Remove all handlers for an event (useful for cleanup)
 */
export function clearEvent(event: string): void {
  handlers.delete(event);
}

/**
 * Remove all handlers for all events (useful for testing)
 */
export function clearAllEvents(): void {
  handlers.clear();
}