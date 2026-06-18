/**
 * DOM-based Submission Observer.
 *
 * A fallback/alternative to the network detector. Watches the DOM
 * for changes indicating a successful submission ("Accepted" status).
 *
 * Designed to be resilient to LeetCode UI changes by looking for
 * text content and semantic structure rather than exact, brittle CSS
 * class names (which are often obfuscated/hashed).
 */

import { TypedEmitter } from './emitter';
import { createLogger } from '@/utils/logger';

const log = createLogger('DOMObserver');

export interface DOMSubmissionResult {
  status: 'Accepted';
  runtime?: string;
  memory?: string;
  language?: string;
  timestamp: number;
}

export interface ObserverEventMap {
  'submission:accepted': DOMSubmissionResult;
}

export interface DOMObserverOptions {
  /** Debounce time for mutation processing (ms) */
  debounceMs?: number;
}

const DEFAULTS: Required<DOMObserverOptions> = {
  debounceMs: 250,
};

export class DOMSubmissionObserver {
  readonly events = new TypedEmitter<ObserverEventMap>();

  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private opts: Required<DOMObserverOptions>;
  private destroyed = false;

  /** Track the last processed submission timestamp to avoid duplicate triggers */
  private lastTriggerTime = 0;
  private readonly DEDUPE_WINDOW_MS = 5000;

  constructor(options?: DOMObserverOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /**
   * Start observing the DOM for submission results.
   */
  install(): void {
    if (this.destroyed) {
      throw new Error('Cannot reinstall a destroyed DOMSubmissionObserver.');
    }

    if (this.observer) {
      log.warn('DOM observer is already installed.');
      return;
    }

    log.info('Installing DOM submission observer...');

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Observe the body or main container. We use the body because
    // the layout container might be completely replaced during SPA navigation.
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    log.info('DOM submission observer installed.');
  }

  /**
   * Stop observing and clean up resources.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.events.destroy();
    log.info('DOM submission observer destroyed.');
  }

  // ── Internal ───────────────────────────────────────────────────

  private handleMutations(mutations: MutationRecord[]): void {
    if (this.destroyed) return;

    // Fast-path: check if any added nodes or text changes could
    // potentially be a submission result to avoid unnecessary work.
    const hasRelevantChanges = mutations.some((m) => {
      if (m.type === 'childList' && m.addedNodes.length > 0) return true;
      if (m.type === 'characterData') return true;
      return false;
    });

    if (!hasRelevantChanges) return;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.checkForAcceptedStatus();
    }, this.opts.debounceMs);
  }

  private checkForAcceptedStatus(): void {
    if (this.destroyed) return;

    try {
      // Deduplicate: If we already triggered within the window, ignore.
      const now = Date.now();
      if (now - this.lastTriggerTime < this.DEDUPE_WINDOW_MS) {
        return;
      }

      // Robust check: Look for the text "Accepted" in a high-level span/div.
      // LeetCode typically shows a large "Accepted" text in green when a submission passes.
      // We look for elements containing "Accepted" exactly.
      const acceptedElements = Array.from(document.querySelectorAll('span, div')).filter((el) => {
        // Direct text content must be "Accepted" to avoid matching random page text
        return this.getDirectText(el) === 'Accepted';
      });

      if (acceptedElements.length === 0) return;

      // Ensure it's actually the submission result area by looking for nearby
      // metrics like "Runtime" or "Memory" which are always present.
      const resultContainer = this.findResultContainer(acceptedElements[0]);

      if (resultContainer) {
        log.info('Found Accepted submission via DOM observer!');
        this.lastTriggerTime = now;

        const metrics = this.extractMetrics(resultContainer);

        this.events.emit('submission:accepted', {
          status: 'Accepted',
          runtime: metrics.runtime,
          memory: metrics.memory,
          language: metrics.language,
          timestamp: now,
        });
      }
    } catch (error) {
      log.error('Error during DOM checking for accepted status:', error);
    }
  }

  /**
   * Traverse up from the "Accepted" element to find a container
   * that encompasses the entire result (which includes Runtime/Memory).
   */
  private findResultContainer(acceptedElement: Element): Element | null {
    let current: Element | null = acceptedElement;
    let depth = 0;

    // Go up to 10 levels to find the encompassing container
    while (current && depth < 10) {
      const text = current.textContent || '';
      // A valid result container usually contains these keywords
      if (text.includes('Runtime') || text.includes('Memory')) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Extract runtime, memory, and language from the result container.
   * Resilient to markup changes by using regex on text content.
   */
  private extractMetrics(container: Element): {
    runtime?: string;
    memory?: string;
    language?: string;
  } {
    const text = container.textContent || '';
    const metrics: { runtime?: string; memory?: string; language?: string } = {};

    // E.g., "Runtime 40 ms Beats 90.00%"
    const runtimeMatch = text.match(/Runtime\s*(\d+\s*ms)/i);
    if (runtimeMatch) {
      metrics.runtime = runtimeMatch[1];
    }

    // E.g., "Memory 16.5 MB Beats 80.00%"
    const memoryMatch = text.match(/Memory\s*([\d.]+\s*MB)/i);
    if (memoryMatch) {
      metrics.memory = memoryMatch[1];
    }

    // Language might be present nearby, often as a badge or text
    const langMatch = text.match(
      /(cpp|java|python|python3|c|csharp|javascript|typescript|php|swift|kotlin|dart|go|ruby|scala|rust|racket|erlang|elixir)/i
    );
    if (langMatch) {
      metrics.language = langMatch[1].toLowerCase();
    }

    return metrics;
  }

  /**
   * Helper to get only the direct text content of an element,
   * excluding text from its children.
   */
  private getDirectText(el: Element): string {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      }
    }
    return text.trim();
  }
}
