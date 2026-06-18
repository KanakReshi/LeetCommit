/**
 * Typed event emitter.
 *
 * A lightweight, generic event bus with full TypeScript type safety.
 * Supports `on`, `off`, `once`, `emit`, and `destroy` with proper
 * listener cleanup to prevent memory leaks.
 *
 * Usage:
 *   interface Events { click: { x: number; y: number }; close: void }
 *   const bus = new TypedEmitter<Events>();
 *   bus.on('click', (e) => console.log(e.x)); // e is typed
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('Emitter');

/** Listener function type — extracts the payload for a given event */
type Listener<T> = T extends void ? () => void : (payload: T) => void;

/**
 * A strongly-typed event emitter.
 *
 * @typeParam T — A record mapping event names to their payload types.
 *               Use `void` for events that carry no data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEmitter<T extends Record<string, any>> {
  /** Internal listener registry. Each key maps to a Set of callbacks. */
  private listeners = new Map<keyof T, Set<Listener<unknown>>>();

  /** Whether this emitter has been destroyed (no further ops allowed). */
  private destroyed = false;

  // ── Public API ───────────────────────────────────────────────

  /**
   * Register a listener for the given event.
   * Returns an unsubscribe function for convenience.
   */
  on<K extends keyof T>(event: K, listener: Listener<T[K]>): () => void {
    this.assertAlive();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);

    // Return unsubscribe handle
    return () => this.off(event, listener);
  }

  /**
   * Register a one-shot listener. It fires once and auto-removes.
   */
  once<K extends keyof T>(event: K, listener: Listener<T[K]>): () => void {
    const wrapper = ((payload: T[K]) => {
      this.off(event, wrapper as Listener<T[K]>);
      (listener as (payload: T[K]) => void)(payload);
    }) as Listener<T[K]>;

    return this.on(event, wrapper);
  }

  /**
   * Remove a specific listener. No-op if it's not registered.
   */
  off<K extends keyof T>(event: K, listener: Listener<T[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<unknown>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event, invoking all registered listeners synchronously.
   *
   * Uses try/catch per listener so one failing handler doesn't
   * prevent others from executing.
   */
  emit<K extends keyof T>(event: K, ...args: T[K] extends void ? [] : [T[K]]): void {
    if (this.destroyed) return;

    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    const payload = args[0];
    for (const listener of set) {
      try {
        (listener as (p: unknown) => void)(payload);
      } catch (error) {
        log.error(`Error in listener for "${String(event)}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for a specific event,
   * or all listeners entirely if no event is specified.
   */
  removeAllListeners(event?: keyof T): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Return the number of listeners for a given event.
   */
  listenerCount(event: keyof T): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Permanently disable this emitter, clearing all listeners.
   * Any subsequent `on`/`emit` calls will throw.
   */
  destroy(): void {
    this.listeners.clear();
    this.destroyed = true;
    log.debug('Emitter destroyed.');
  }

  /** @returns `true` if `destroy()` has been called */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  // ── Internal ─────────────────────────────────────────────────

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('[LeetCommit] Cannot use a destroyed emitter.');
    }
  }
}
