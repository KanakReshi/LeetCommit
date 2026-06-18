/**
 * Navigation and page detection types.
 */

/** Recognized LeetCode page types */
export type PageType = 'problem' | 'problemList' | 'contest' | 'submission' | 'profile' | 'other';

/** Context for the current page */
export interface PageContext {
  /** Classified page type */
  type: PageType;
  /** Full URL */
  url: string;
  /** Problem slug if on a problem page, null otherwise */
  slug: string | null;
  /** Epoch ms when this context was created */
  timestamp: number;
}

/** Map of event names to their payload types */
export interface NavigationEventMap {
  /** Fired when a new page is entered (including initial load) */
  'page:enter': PageContext;
  /** Fired when a page is left (before the new one loads) */
  'page:leave': PageContext;
  /** Fired on any page transition with both old and new context */
  'page:change': { from: PageContext | null; to: PageContext };
  /** Fired specifically when entering a problem page */
  'problem:enter': PageContext;
  /** Fired specifically when leaving a problem page */
  'problem:leave': PageContext;
}
