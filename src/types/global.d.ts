/**
 * Global type declarations for the LeetCommit extension.
 *
 * Provides the `browser` namespace for Firefox WebExtension APIs
 * and compile-time constants injected by Vite's `define` config.
 */

// ── Compile-time constants (injected by Vite) ────────────────────

declare const __API_URL__: string;
declare const __API_KEY__: string;

// ── Firefox WebExtension API ─────────────────────────────────────

/**
 * Minimal type declarations for the `browser.*` APIs used by
 * this extension. This avoids pulling in the full
 * @types/webextension-polyfill package while still providing
 * type safety for the APIs we actually use.
 */
declare namespace browser {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number; url?: string };
      frameId?: number;
      id?: string;
      url?: string;
    }

    interface InstalledDetails {
      reason: 'install' | 'update' | 'browser_update';
      previousVersion?: string;
    }

    function sendMessage(message: unknown): Promise<unknown>;

    const onMessage: {
      addListener(
        callback: (message: unknown, sender: MessageSender) => Promise<unknown> | void
      ): void;
      removeListener(callback: (...args: unknown[]) => void): void;
    };

    const onInstalled: {
      addListener(callback: (details: InstalledDetails) => void): void;
    };

    const onStartup: {
      addListener(callback: () => void): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(
        keys: string | string[] | Record<string, unknown> | null
      ): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
    const session: StorageArea;
  }
}
