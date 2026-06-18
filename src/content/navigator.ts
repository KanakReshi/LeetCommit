/**
 * LeetCode SPA page navigator.
 *
 * Detects page transitions in LeetCode's React SPA by monitoring:
 *
 * 1. **History API** — Intercepts `pushState` / `replaceState` to catch
 *    programmatic navigation that doesn't fire `popstate`.
 * 2. **Popstate** — Catches browser back/forward navigation.
 * 3. **MutationObserver** — Watches `<title>` and key DOM nodes for
 *    SPA-driven content swaps that don't touch the History API.
 * 4. **Polling fallback** — A low-frequency interval check as a safety
 *    net in case all three above miss an edge case.
 *
 * All detected transitions are deduplicated and emitted through a
 * `TypedEmitter<NavigationEventMap>`.
 *
 * Memory-safe: call `destroy()` to tear down all listeners, observers,
 * and intervals cleanly.
 */

import type { PageType, PageContext, NavigationEventMap } from '@/types/navigation';
import { TypedEmitter } from './emitter';
import { createLogger } from '@/utils/logger';

const log = createLogger('Navigator');

// ── URL classification ───────────────────────────────────────────

const ROUTE_PATTERNS: { type: PageType; pattern: RegExp }[] = [
  { type: 'problem', pattern: /^\/problems\/([a-z0-9-]+)/ },
  { type: 'problemList', pattern: /^\/problemset\b/ },
  { type: 'contest', pattern: /^\/contest\b/ },
  { type: 'submission', pattern: /^\/submissions\b/ },
  { type: 'profile', pattern: /^\/u\// },
];

function classifyUrl(url: string): { type: PageType; slug: string | null } {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  for (const { type, pattern } of ROUTE_PATTERNS) {
    const match = pathname.match(pattern);
    if (match) {
      return {
        type,
        slug: type === 'problem' ? (match[1] ?? null) : null,
      };
    }
  }

  return { type: 'other', slug: null };
}

function buildContext(url: string): PageContext {
  const { type, slug } = classifyUrl(url);
  return { type, url, slug, timestamp: Date.now() };
}

// ── Navigator ────────────────────────────────────────────────────

/** Configuration for the navigator */
export interface NavigatorOptions {
  /** Minimum ms between two consecutive change events (debounce) */
  debounceMs?: number;
  /** Interval ms for the polling fallback (0 = disabled) */
  pollIntervalMs?: number;
}

const DEFAULTS: Required<NavigatorOptions> = {
  debounceMs: 150,
  pollIntervalMs: 2000,
};

export class PageNavigator {
  /** Public event bus — subscribe to navigation events here */
  readonly events: TypedEmitter<NavigationEventMap>;

  /** The most recently emitted page context */
  private currentContext: PageContext | null = null;

  /** Timestamp of the last emitted change (for debouncing) */
  private lastChangeTime = 0;

  /** Pending debounce timer */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Polling interval handle */
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** URL at last check (for polling dedup) */
  private lastCheckedUrl = '';

  /** Resolved options */
  private opts: Required<NavigatorOptions>;

  /** Original History methods (saved for cleanup) */
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;

  /** Bound event handler references (for removeEventListener) */
  private boundOnPopState: () => void;
  private boundOnHashChange: () => void;

  /** MutationObserver instance */
  private titleObserver: MutationObserver | null = null;
  private bodyObserver: MutationObserver | null = null;

  /** Lifecycle flag */
  private destroyed = false;

  constructor(options?: NavigatorOptions) {
    this.opts = { ...DEFAULTS, ...options };
    this.events = new TypedEmitter<NavigationEventMap>();

    // Bind handlers so they can be cleanly removed later
    this.boundOnPopState = this.onUrlChange.bind(this);
    this.boundOnHashChange = this.onUrlChange.bind(this);

    this.install();
  }

  // ── Public API ─────────────────────────────────────────────

  /** The current page context, or null if not yet initialised */
  get current(): PageContext | null {
    return this.currentContext;
  }

  /**
   * Tear down all listeners, observers, intervals, and patches.
   * Safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    log.info('Destroying navigator...');

    // Clear timers
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Remove event listeners
    window.removeEventListener('popstate', this.boundOnPopState);
    window.removeEventListener('hashchange', this.boundOnHashChange);

    // Restore History API
    if (this.origPushState) {
      history.pushState = this.origPushState;
      this.origPushState = null;
    }
    if (this.origReplaceState) {
      history.replaceState = this.origReplaceState;
      this.origReplaceState = null;
    }

    // Disconnect observers
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }
    if (this.bodyObserver) {
      this.bodyObserver.disconnect();
      this.bodyObserver = null;
    }

    // Destroy event bus
    this.events.destroy();

    log.info('Navigator destroyed.');
  }

  // ── Installation ───────────────────────────────────────────

  private install(): void {
    log.info('Installing page navigator...');

    this.patchHistoryApi();
    this.installEventListeners();
    this.installTitleObserver();
    this.installBodyObserver();
    this.installPollingFallback();

    // Emit the initial page context
    this.lastCheckedUrl = window.location.href;
    const ctx = buildContext(window.location.href);
    this.setContext(ctx, true);

    log.info('Navigator installed. Initial page:', ctx.type, ctx.slug ?? '');
  }

  // ── History API patching ───────────────────────────────────

  /**
   * Monkey-patch pushState and replaceState so we get notified
   * of SPA navigations that don't fire popstate.
   */
  private patchHistoryApi(): void {
    this.origPushState = history.pushState.bind(history);
    this.origReplaceState = history.replaceState.bind(history);

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.origPushState!(...args);
      this.onUrlChange();
    };

    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.origReplaceState!(...args);
      this.onUrlChange();
    };
  }

  // ── Event listeners ────────────────────────────────────────

  private installEventListeners(): void {
    window.addEventListener('popstate', this.boundOnPopState);
    window.addEventListener('hashchange', this.boundOnHashChange);
  }

  // ── MutationObserver: <title> ──────────────────────────────

  /**
   * Watch for `<title>` text changes. LeetCode updates the title
   * when navigating between problems (e.g. "Two Sum - LeetCode").
   */
  private installTitleObserver(): void {
    const titleElement = document.querySelector('title');
    if (!titleElement) {
      log.debug('No <title> element found; skipping title observer.');
      return;
    }

    this.titleObserver = new MutationObserver(() => {
      this.onUrlChange();
    });

    this.titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // ── MutationObserver: <body> (structural) ──────────────────

  /**
   * Watch for large structural DOM changes in `<body>` that indicate
   * a full SPA route swap (e.g. switching from problem list to editor).
   *
   * Uses a heuristic: if a single mutation batch adds/removes many
   * top-level children, it's likely a route change.
   */
  private installBodyObserver(): void {
    const target = document.getElementById('__next') ?? document.body;

    this.bodyObserver = new MutationObserver((mutations) => {
      // Heuristic: large childList change at a high-level container
      const significantChange = mutations.some(
        (m) => m.type === 'childList' && (m.addedNodes.length > 2 || m.removedNodes.length > 2)
      );

      if (significantChange) {
        this.onUrlChange();
      }
    });

    this.bodyObserver.observe(target, {
      childList: true,
      subtree: false, // Only direct children — avoids noise
    });
  }

  // ── Polling fallback ───────────────────────────────────────

  /**
   * Low-frequency poll as a safety net.
   * Catches edge cases where History API patching and observers
   * both miss a navigation (e.g. turbo-driven page swaps).
   */
  private installPollingFallback(): void {
    if (this.opts.pollIntervalMs <= 0) return;

    this.pollTimer = setInterval(() => {
      if (window.location.href !== this.lastCheckedUrl) {
        log.debug('Polling fallback detected URL change.');
        this.onUrlChange();
      }
    }, this.opts.pollIntervalMs);
  }

  // ── Core change handler ────────────────────────────────────

  /**
   * Called by every detection mechanism. Debounces and deduplicates
   * before emitting events.
   */
  private onUrlChange(): void {
    if (this.destroyed) return;

    // Debounce rapid-fire calls (e.g. pushState + MutationObserver
    // both triggering within the same frame)
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.checkForChange();
    }, this.opts.debounceMs);
  }

  /**
   * Actually compare the current URL/page state against the last
   * known context and emit events if something changed.
   */
  private checkForChange(): void {
    const currentUrl = window.location.href;
    this.lastCheckedUrl = currentUrl;

    const newCtx = buildContext(currentUrl);

    // Deduplicate: same URL + same slug = same page
    if (this.currentContext && this.isSamePage(this.currentContext, newCtx)) {
      return;
    }

    // Rate-limit (belt-and-suspenders with debounce)
    const now = Date.now();
    if (now - this.lastChangeTime < 50) return;
    this.lastChangeTime = now;

    this.setContext(newCtx, false);
  }

  /**
   * Commit a new page context and emit all relevant events.
   */
  private setContext(newCtx: PageContext, isInitial: boolean): void {
    const prev = this.currentContext;
    this.currentContext = newCtx;

    // page:leave for the old page
    if (prev && !isInitial) {
      this.events.emit('page:leave', prev);

      if (prev.type === 'problem') {
        this.events.emit('problem:leave', prev);
      }
    }

    // page:enter for the new page
    this.events.emit('page:enter', newCtx);

    if (newCtx.type === 'problem') {
      this.events.emit('problem:enter', newCtx);
    }

    // page:change (always fired, even on initial load)
    this.events.emit('page:change', { from: isInitial ? null : prev, to: newCtx });

    log.info(
      isInitial ? 'Initial page:' : 'Page changed:',
      `${newCtx.type}${newCtx.slug ? ` (${newCtx.slug})` : ''}`
    );
  }

  /**
   * Two contexts are "the same page" if they have the same type
   * and, for problem pages, the same slug. URL params (e.g. tab
   * switches) are intentionally ignored.
   */
  private isSamePage(a: PageContext, b: PageContext): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'problem' && b.type === 'problem') {
      return a.slug === b.slug;
    }
    // For non-problem pages, compare pathname only
    try {
      return new URL(a.url).pathname === new URL(b.url).pathname;
    } catch {
      return a.url === b.url;
    }
  }
}
