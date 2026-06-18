/**
 * Content script entry point.
 *
 * Injected into leetcode.com/problems/* pages.
 *
 * Responsibilities:
 * 1. Detect SPA navigation via the PageNavigator.
 * 2. Install/teardown the submission detector when entering/leaving
 *    problem pages.
 * 3. Forward accepted submissions to the background service worker.
 */

import type { GraphQLSubmissionStatusResponse } from '@/types/leetcode';
import type { SubmissionAcceptedMessage } from '@/types/messages';
import type { PageContext } from '@/types/navigation';
import { installDetector, extractSubmissionIdFromUrl, checkSubmissionResult } from './detector';
import { buildSubmissionPayload } from './extractor';
import { PageNavigator } from './navigator';
import { createLogger } from '@/utils/logger';

const log = createLogger('Content');

// ── State ────────────────────────────────────────────────────────

/** Track already-processed submission IDs to prevent duplicates */
const processedSubmissions = new Set<string>();

/** Current navigator instance (singleton for this content script) */
let navigator: PageNavigator | null = null;

/** Whether the detector has been installed for the current problem */
let detectorInstalled = false;

// ── Submission handling ──────────────────────────────────────────

function handleAcceptedSubmission(
  data: GraphQLSubmissionStatusResponse,
  submissionId: string
): void {
  // Deduplicate — the same submission ID may arrive multiple times
  if (processedSubmissions.has(submissionId)) {
    log.debug('Skipping already-processed submission:', submissionId);
    return;
  }
  processedSubmissions.add(submissionId);

  buildSubmissionPayload(data, submissionId)
    .then((payload) => {
      const message: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        payload,
      };

      log.info('Forwarding accepted submission to background:', submissionId);

      return browser.runtime.sendMessage(message);
    })
    .then((response) => {
      log.info('Background acknowledged:', response);
    })
    .catch((error) => {
      log.error('Failed to send message to background:', error);
    });
}

// ── Navigation callbacks ─────────────────────────────────────────

function onProblemEnter(ctx: PageContext): void {
  log.info('Entered problem page:', ctx.slug);

  if (!detectorInstalled) {
    installDetector(handleAcceptedSubmission);
    detectorInstalled = true;
    log.info('Detector installed for problem:', ctx.slug);
  }
}

function onProblemLeave(ctx: PageContext): void {
  log.info('Left problem page:', ctx.slug);
  // Note: We don't uninstall the detector here because the XHR/fetch
  // patches are global and removing them mid-flight could break
  // pending submission checks. The detector self-deduplicates, so
  // leaving it installed is safe. A full teardown would require
  // restoring the original XHR/fetch prototypes, which risks
  // conflicting with other extensions or LeetCode's own code.
  //
  // The deduplication Set prevents any stale events from being processed.
}

function onPageChange(event: { from: PageContext | null; to: PageContext }): void {
  log.debug(`Navigation: ${event.from?.type ?? 'initial'} → ${event.to.type}`);

  const submissionId = extractSubmissionIdFromUrl(event.to.url);
  if (submissionId && !processedSubmissions.has(submissionId)) {
    processedSubmissions.add(submissionId);
    log.info('Submission result page detected, querying for result:', submissionId);
    checkSubmissionResult(submissionId, handleAcceptedSubmission).catch((err) => {
      log.error('Failed to check submission result:', err);
    });
  }
}

// ── URL watcher (independent of navigator page classification) ────

function watchSubmissionUrls(): void {
  // Separate set to avoid re-checking the same submission URL — distinct from
  // processedSubmissions which gates the backend send in handleAcceptedSubmission.
  const checkedUrls = new Set<string>();
  let lastUrl = window.location.href;

  function maybeCheck(url: string): void {
    const id = extractSubmissionIdFromUrl(url);
    if (id && !checkedUrls.has(id)) {
      checkedUrls.add(id);
      log.info('Submission URL detected:', id);
      checkSubmissionResult(id, handleAcceptedSubmission).catch((err) =>
        log.error('checkSubmissionResult failed:', err)
      );
    }
  }

  maybeCheck(lastUrl);

  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    log.debug('URL changed to:', currentUrl);
    lastUrl = currentUrl;
    maybeCheck(currentUrl);
  }, 500);
}

// ── Bootstrap ────────────────────────────────────────────────────

function init(): void {
  log.info('Content script loaded on', window.location.href);

  // Direct URL polling — more reliable than navigator events for submission pages
  watchSubmissionUrls();

  // Create the navigator — it immediately emits the initial page context
  navigator = new PageNavigator({
    debounceMs: 150,
    pollIntervalMs: 2000,
  });

  // Subscribe to navigation events
  navigator.events.on('problem:enter', onProblemEnter);
  navigator.events.on('problem:leave', onProblemLeave);
  navigator.events.on('page:change', onPageChange);

  // Also install the detector immediately if we're already on a problem page
  // (handles the case where the content script is injected into a problem URL)
  const current = navigator.current;
  if (current?.type === 'problem' && !detectorInstalled) {
    installDetector(handleAcceptedSubmission);
    detectorInstalled = true;
    log.info('Detector installed on initial load for:', current.slug);
  }
}

// Run immediately — content_scripts with run_at: document_idle
// guarantees the DOM is ready.
init();

// ── Cleanup on unload ────────────────────────────────────────────
// Teardown when the page is unloaded to prevent orphaned listeners
// in edge cases (e.g. full hard navigation away from LeetCode).

window.addEventListener(
  'unload',
  () => {
    if (navigator) {
      navigator.destroy();
      navigator = null;
    }
  },
  { once: true }
);
