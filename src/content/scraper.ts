/**
 * LeetCode Scraper Module.
 *
 * Extracts problem metadata and submission code from the DOM.
 * Implements fault tolerance, retry logic for asynchronous React rendering,
 * and clean fallback selectors.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('Scraper');

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Unknown';

export interface ScrapedData {
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
  language: string;
  code: string;
  timestamp: number;
  url: string;
}

export interface ScraperOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULTS: Required<ScraperOptions> = {
  maxRetries: 5,
  retryDelayMs: 500,
};

export class LeetCodeScraper {
  private opts: Required<ScraperOptions>;

  constructor(options?: ScraperOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /**
   * Main entry point. Attempts to scrape the page, retrying if critical
   * elements (like the title or code) are not yet rendered by the SPA.
   */
  public async scrape(): Promise<ScrapedData> {
    log.info('Starting scrape...');

    for (let attempt = 1; attempt <= this.opts.maxRetries; attempt++) {
      try {
        const data = this.attemptScrape();

        // Validation: If we got the basic critical data, consider it a success.
        // The code editor might be virtualized or empty, so we don't strictly fail on empty code,
        // but we do want the title and slug.
        if (data.title && data.slug) {
          log.info('Scrape successful on attempt', attempt);
          return data;
        }

        log.debug(`Attempt ${attempt} missing critical data. Retrying...`);
      } catch (error) {
        log.warn(`Attempt ${attempt} failed with error:`, error);
      }

      if (attempt < this.opts.maxRetries) {
        await this.delay(this.opts.retryDelayMs);
      }
    }

    log.error('All scraping attempts failed. Returning best-effort data.');
    return this.attemptScrape(); // Return whatever we can get
  }

  // ── Core Scraping Logic ────────────────────────────────────────────────

  private attemptScrape(): ScrapedData {
    const url = window.location.href;
    const slug = this.extractSlug(url);
    const title = this.extractTitle() || slug;
    const difficulty = this.extractDifficulty();
    const tags = this.extractTags();
    const codeInfo = this.extractCodeAndLanguage();

    return {
      title,
      slug,
      difficulty,
      tags,
      language: codeInfo.language,
      code: codeInfo.code,
      timestamp: Date.now(),
      url,
    };
  }

  // ── Extractors ─────────────────────────────────────────────────────────

  private extractSlug(url: string): string {
    const match = url.match(/\/problems\/([a-z0-9-]+)/);
    return match ? match[1] : 'unknown';
  }

  private extractTitle(): string {
    const selectors = [
      '[data-cy="question-title"]', // Old UI
      'div[class*="text-title"] a', // Intermediate UI
      'span[class*="text-lg"]', // Current UI (Problem title)
      'div.flex.items-start > div.text-title-large a',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.textContent) {
        const raw = el.textContent.trim();
        // Remove problem number prefix e.g., "1. Two Sum" -> "Two Sum"
        return raw.replace(/^\d+\.\s*/, '');
      }
    }

    return '';
  }

  private extractDifficulty(): Difficulty {
    const selectors = [
      'div[class*="text-difficulty-easy"]',
      'div[class*="text-difficulty-medium"]',
      'div[class*="text-difficulty-hard"]',
      'span[class*="text-easy"]',
      'span[class*="text-medium"]',
      'span[class*="text-hard"]',
      'div[diff]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.textContent) {
        const text = el.textContent.trim() as Difficulty;
        if (['Easy', 'Medium', 'Hard'].includes(text)) {
          return text;
        }
      }
    }

    return 'Unknown';
  }

  private extractTags(): string[] {
    const tagElements = document.querySelectorAll(
      'a[class*="topic-tag"], a[href*="/tag/"], div[class*="tag-"] a'
    );

    if (tagElements.length === 0) return [];

    return Array.from(tagElements)
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean);
  }

  private extractCodeAndLanguage(): { code: string; language: string } {
    let language = 'unknown';
    let code = '';

    // 1. Try to extract language from the language selector button
    const langSelectors = [
      'button[id^="headlessui-listbox-button"]', // Monaco wrapper
      'div[class*="editor-lang-btn"]',
      'div[class*="lang-select"] button',
    ];

    for (const selector of langSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent) {
        // e.g. "C++", "Python3", "Java"
        language = el.textContent.trim().toLowerCase().replace('++', 'cpp');
        break;
      }
    }

    // 2. Extract code from Monaco editor lines
    // Note: Monaco uses virtualization, so this only captures visible lines.
    // In a real submission scenario, the XHR interceptor payload contains the full code,
    // which is far more reliable than DOM scraping the editor.
    const codeLines = document.querySelectorAll('.view-line');
    if (codeLines.length > 0) {
      code = Array.from(codeLines)
        .map((line) => line.textContent || '')
        .join('\n');
    }

    // Fallback for code: Check localStorage if the language is known
    if (!code && language !== 'unknown') {
      const slug = this.extractSlug(window.location.href);
      try {
        const key = `${slug}_${language}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          code = stored;
        }
      } catch (e) {
        log.debug('Could not read localStorage for code fallback.', e);
      }
    }

    return { code, language };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
