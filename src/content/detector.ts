/**
 * Submission detector.
 *
 * Uses URL-based detection instead of XHR/fetch monkey-patching.
 *
 * When LeetCode navigates to /problems/{slug}/submissions/{id}/,
 * we extract the submission ID and query LeetCode's GraphQL API
 * directly for the result. This is more reliable than intercepting
 * network requests because LeetCode's SPA may capture fetch references
 * before the content script runs.
 */

import type { GraphQLSubmissionStatusResponse } from '@/types/leetcode';
import { createLogger } from '@/utils/logger';

const log = createLogger('Detector');

export type AcceptedCallback = (
  data: GraphQLSubmissionStatusResponse,
  submissionId: string
) => void;

/**
 * Extract submission ID if the URL is a submission result page.
 * Matches: /problems/{slug}/submissions/{id}/
 */
export function extractSubmissionIdFromUrl(url: string): string | null {
  const match = url.match(/\/problems\/[^/]+\/submissions\/(\d+)/);
  return match ? match[1] : null;
}

const PENDING_CODES = new Set([0, 16]); // 0 = pending, 16 = not ready / internal transient

/**
 * Query LeetCode GraphQL for submission details and fire the callback
 * if the submission was accepted. Retries until the result is final.
 */
export async function checkSubmissionResult(
  submissionId: string,
  onAccepted: AcceptedCallback
): Promise<void> {
  log.info('Checking submission result for ID:', submissionId);

  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        statusCode
        statusDisplay
        runtime
        memory
        code
        lang { name verboseName }
      }
    }
  `;

  const MAX_ATTEMPTS = 12;
  const DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    try {
      const res = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({
          query,
          variables: { submissionId: parseInt(submissionId, 10) },
        }),
      });

      const json = await res.json();
      const details = json?.data?.submissionDetails;

      if (!details) {
        log.warn(`Attempt ${attempt}: no submissionDetails in response`);
        continue;
      }

      log.debug(`Attempt ${attempt}: statusCode=${details.statusCode} statusDisplay=${details.statusDisplay}`);

      // Still processing — retry
      if (PENDING_CODES.has(details.statusCode)) {
        log.debug(`Attempt ${attempt}: result not ready yet, retrying...`);
        continue;
      }

      if (details.statusCode === 10 || details.statusDisplay === 'Accepted') {
        log.info('✅ Accepted submission confirmed:', submissionId);
        onAccepted(
          {
            state: 'SUCCESS',
            status_msg: 'Accepted',
            status_runtime: details.runtime != null ? String(details.runtime) : 'N/A',
            status_memory: details.memory != null ? String(details.memory) : 'N/A',
            lang: details.lang?.name ?? 'unknown',
            submission_id: submissionId,
            code: details.code ?? '',
          },
          submissionId
        );
      } else {
        log.debug('Not accepted:', details.statusDisplay || details.statusCode);
      }
      return;
    } catch (err) {
      log.warn(`Attempt ${attempt}: fetch error:`, err);
    }
  }

  log.warn('Gave up polling for submission:', submissionId);
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

/** Kept for API compatibility — detection now happens via URL in index.ts */
export function installDetector(_onAccepted: AcceptedCallback): void {
  log.info('Detector ready (URL-based mode).');
}
