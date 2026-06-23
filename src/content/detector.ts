/**
 * Submission detector.
 *
 * Uses URL-based detection instead of XHR/fetch monkey-patching.
 *
 * When LeetCode navigates to /problems/{slug}/submissions/{id}/,
 * we extract the submission ID and query LeetCode's GraphQL API
 * directly for the result.
 */

import type { GraphQLSubmissionStatusResponse } from '@/types/leetcode';
import { createLogger } from '@/utils/logger';

const log = createLogger('Detector');

export type AcceptedCallback = (
  data: GraphQLSubmissionStatusResponse,
  submissionId: string
) => void;

/**
 * Extract submission ID from URL
 */
export function extractSubmissionIdFromUrl(url: string): string | null {
  const match = url.match(/\/problems\/[^/]+\/submissions\/(\d+)/);
  return match ? match[1] : null;
}

const PENDING_CODES = new Set([0, 16]);

/**
 * Main submission checker
 */
export async function checkSubmissionResult(
  submissionId: string,
  onAccepted: AcceptedCallback
): Promise<void> {
  log.info('Checking submission:', submissionId);

  const statusQuery = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        statusCode
        statusDisplay
      }
    }
  `;

  const fullQuery = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {

        runtime
        runtimeDisplay
        runtimePercentile

        memory
        memoryDisplay
        memoryPercentile

        code
        timestamp

        statusCode
        aiJudgeMessage

        isCompiledLang
        aiRecheckSubmitted


        user {
          username
          profile {
            realName
            userAvatar
          }
        }


        lang {
          name
          verboseName
        }


        question {
          questionId
          titleSlug
          hasFrontendPreview
        }


        notes
        flagType


        topicTags {
          tagId
          slug
          name
        }


        runtimeError
        compileError


        lastTestcase

        codeOutput
        expectedOutput


        totalCorrect
        totalTestcases


        fullCodeOutput


        testDescriptions
        testBodies
        testInfo


        stdOutput
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
      /**
       * First request:
       * Check whether result is ready
       */

      const statusRes = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': getCsrfToken(),
        },

        credentials: 'include',

        body: JSON.stringify({
          operationName: 'submissionDetails',

          query: statusQuery,

          variables: {
            submissionId: Number(submissionId),
          },
        }),
      });

      const statusJson = await statusRes.json();

      const status = statusJson?.data?.submissionDetails;

      if (!status) {
        log.warn(`Attempt ${attempt}: no submission data`);

        continue;
      }

      log.debug(`Attempt ${attempt}:`, status.statusCode, status.statusDisplay);

      /**
       * Still running
       */

      if (PENDING_CODES.has(status.statusCode)) {
        log.debug('Submission pending...');

        continue;
      }

      /**
       * Accepted
       */

      if (status.statusCode === 10 || status.statusDisplay === 'Accepted') {
        log.info('Accepted submission:', submissionId);

        /**
         * Second request:
         * Get complete submission details
         */

        const detailRes = await fetch('https://leetcode.com/graphql/', {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'x-csrftoken': getCsrfToken(),
          },

          credentials: 'include',

          body: JSON.stringify({
            operationName: 'submissionDetails',

            query: fullQuery,

            variables: {
              submissionId: Number(submissionId),
            },
          }),
        });

        const detailJson = await detailRes.json();

        const details = detailJson?.data?.submissionDetails;

        if (!details) {
          log.error('Failed getting full submission');

          return;
        }

        onAccepted(
          {
            state: 'SUCCESS',

            status_msg: 'Accepted',

            status_runtime: details.runtimeDisplay ?? String(details.runtime ?? 'N/A'),

            status_memory: details.memoryDisplay ?? String(details.memory ?? 'N/A'),

            runtime_percentile: details.runtimePercentile,

            memory_percentile: details.memoryPercentile,

            lang: details.lang?.name ?? 'unknown',

            submission_id: submissionId,

            question_id: details.question?.questionId
              ? String(details.question.questionId)
              : undefined,

            code: details.code ?? '',
          },

          submissionId
        );
      } else {
        log.debug('Not accepted:', status.statusDisplay);
      }

      return;
    } catch (err) {
      log.warn(`Attempt ${attempt} failed`, err);
    }
  }

  log.warn('Stopped checking:', submissionId);
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);

  return match ? match[1] : '';
}

/**
 * Kept for compatibility
 */
export function installDetector(_onAccepted: AcceptedCallback): void {
  log.info('Detector ready');
}
