/**
 * Submission submitter with retry queue.
 *
 * - Sends accepted submissions to the configured backend API.
 * - Implements exponential backoff on failure.
 * - Queues failed submissions in browser.storage.local for later retry.
 */

import type { SubmissionPayload } from '@/types/leetcode';
import { sendSubmission } from '@/utils/api';
import { getStorage, setStorage, incrementCounter } from '@/utils/storage';
import { StorageService } from '@/services/StorageService';
import { RETRY_CONFIG } from '@/constants';
import { createLogger } from '@/utils/logger';

const log = createLogger('Submitter');

/**
 * Process a newly detected submission:
 * 1. Increment the detected counter.
 * 2. Check if sending is enabled.
 * 3. Attempt to send with retries.
 * 4. On final failure, queue for later.
 */
export async function submitToBackend(payload: SubmissionPayload): Promise<void> {
  // Always record the detection
  await incrementCounter('totalDetected');
  await setStorage({ lastSubmission: payload, lastError: null });

  // Read tokens from StorageService — the single source of truth written by the OAuth flow
  const tokenConfig = await StorageService.getToken();
  const success = await attemptSendWithRetries(payload, {
    apiUrl: tokenConfig.apiUrl,
    accessToken: tokenConfig.accessToken,
  });

  if (success) {
    await incrementCounter('totalSent');
    log.info('Submission successfully sent to backend.');
  } else {
    await incrementCounter('totalFailed');
    await addToFailedQueue(payload);
    log.warn('Submission queued for retry after all attempts failed.');
  }
}

/**
 * Retry all submissions in the failed queue.
 * Returns the number of submissions retried.
 */
export async function retryFailed(): Promise<number> {
  const { failedQueue } = await getStorage(['failedQueue']);
  const tokenConfig = await StorageService.getToken();
  const { apiUrl, accessToken } = tokenConfig;

  if (failedQueue.length === 0) {
    log.info('No failed submissions to retry.');
    return 0;
  }

  log.info(`Retrying ${failedQueue.length} failed submissions...`);

  const remaining: SubmissionPayload[] = [];
  let retriedCount = 0;

  for (const payload of failedQueue) {
    const success = await attemptSendWithRetries(payload, { apiUrl, accessToken });
    if (success) {
      await incrementCounter('totalSent');
      retriedCount++;
    } else {
      remaining.push(payload);
    }
  }

  await setStorage({
    failedQueue: remaining,
    totalFailed: remaining.length,
  });

  log.info(`Retry complete. ${retriedCount} sent, ${remaining.length} still pending.`);
  return retriedCount;
}

// ── Internal ─────────────────────────────────────────────────────

async function attemptSendWithRetries(
  payload: SubmissionPayload,
  config: { apiUrl: string; accessToken: string }
): Promise<boolean> {
  for (let attempt = 0; attempt < RETRY_CONFIG.MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(
        RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1),
        RETRY_CONFIG.MAX_DELAY_MS
      );
      log.info(`Retry attempt ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
    }

    const result = await sendSubmission(payload, config);

    if (result.success) {
      return true;
    }

    // Handle OAuth Token Expiration (401 Unauthorized)
    if (result.statusCode === 401) {
      log.warn('Access token expired, attempting to refresh session...');
      try {
        const { refreshSession } = await import('./auth');
        const newToken = await refreshSession();
        // Update config for the next retry iteration
        config.accessToken = newToken;
        continue; // Immediately retry with new token
      } catch (refreshErr) {
        log.error('Session refresh failed. User needs to re-authenticate.', refreshErr);
        await setStorage({ lastError: 'Session expired. Please log in again via GitHub.' });
        return false;
      }
    }

    await setStorage({ lastError: result.message });

    // Don't retry on other 4xx — those are client errors that won't fix themselves
    if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
      log.error('Client error — not retrying:', result.message);
      return false;
    }
  }

  return false;
}

async function addToFailedQueue(payload: SubmissionPayload): Promise<void> {
  const { failedQueue } = await getStorage('failedQueue');
  const updated = [...failedQueue, payload];

  // Cap the queue at 100 entries to prevent unbounded growth
  const capped = updated.slice(-100);
  await setStorage({ failedQueue: capped });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
