/**
 * Problem metadata extractor.
 *
 * Reads problem details from:
 * - The current URL (slug)
 * - The DOM (title, difficulty, tags)
 * - The intercepted submission response (runtime, memory, lang)
 */

import type {
  LeetCodeProblem,
  LeetCodeSubmission,
  SubmissionPayload,
  GraphQLSubmissionStatusResponse,
  Difficulty,
} from '@/types/leetcode';
import { LEETCODE } from '@/constants';
import { createLogger } from '@/utils/logger';

const log = createLogger('Extractor');

/**
 * Extract the problem slug from the current page URL.
 */
export function extractSlugFromUrl(): string | null {
  const match = window.location.href.match(LEETCODE.PROBLEM_URL_PATTERN);
  return match?.[1] ?? null;
}

/**
 * Extract problem metadata from the DOM.
 * Falls back gracefully when elements aren't found.
 */
export function extractProblemFromDOM(): Partial<LeetCodeProblem> {
  const slug = extractSlugFromUrl();
  const result: Partial<LeetCodeProblem> = { titleSlug: slug ?? undefined };

  try {
    // Title — usually the first heading or a specific element
    const titleEl =
      document.querySelector('[data-cy="question-title"]') ??
      document.querySelector('div[class*="text-title"] a') ??
      document.querySelector('span[class*="text-lg"]');

    if (titleEl?.textContent) {
      // Title often includes the number prefix like "1. Two Sum"
      const raw = titleEl.textContent.trim();
      const cleaned = raw.replace(/^\d+\.\s*/, '');
      result.title = cleaned;

      // Try to extract question ID from prefix
      const idMatch = raw.match(/^(\d+)\./);
      if (idMatch) {
        result.questionId = idMatch[1];
      }
    }

    // Difficulty badge
    const difficultyEl = document.querySelector(
      'div[class*="text-difficulty-easy"], div[class*="text-difficulty-medium"], div[class*="text-difficulty-hard"], ' +
        'span[class*="text-easy"], span[class*="text-medium"], span[class*="text-hard"], ' +
        'div[diff]'
    );

    if (difficultyEl?.textContent) {
      const text = difficultyEl.textContent.trim();
      if (['Easy', 'Medium', 'Hard'].includes(text)) {
        result.difficulty = text as Difficulty;
      }
    }

    // Topic tags
    const tagElements = document.querySelectorAll(
      'a[class*="topic-tag"], a[href*="/tag/"], div[class*="tag-"] a'
    );
    if (tagElements.length > 0) {
      result.tags = Array.from(tagElements)
        .map((el) => el.textContent?.trim() ?? '')
        .filter(Boolean);
    }
  } catch (error) {
    log.warn('Error extracting problem from DOM:', error);
  }

  return result;
}

async function fetchSubmissionCode(submissionId: string): Promise<string> {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
      }
    }
  `;
  const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
  const res = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrftoken': csrfToken },
    body: JSON.stringify({ query, variables: { submissionId: parseInt(submissionId, 10) } }),
    credentials: 'include',
  });
  const json = await res.json();
  return json?.data?.submissionDetails?.code ?? '';
}

/**
 * Fetches the problem description HTML and category title from LeetCode GraphQL.
 * Uses the user's active browser session (credentials: 'include').
 */
async function fetchProblemDetails(
  titleSlug: string
): Promise<{ descriptionHtml: string; categoryTitle: string }> {
  const query = `
    query questionContent($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        content
        categoryTitle
      }
    }
  `;
  const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrftoken': csrfToken },
      body: JSON.stringify({ query, variables: { titleSlug } }),
      credentials: 'include',
    });
    const json = await res.json();
    return {
      descriptionHtml: json?.data?.question?.content ?? '',
      categoryTitle: json?.data?.question?.categoryTitle ?? 'Algorithms',
    };
  } catch (err) {
    log.warn('Failed to fetch problem details:', err);
    return { descriptionHtml: '', categoryTitle: 'Algorithms' };
  }
}

/**
 * Build a complete SubmissionPayload from the intercepted response
 * and DOM-extracted metadata. Fetches source code and description via GraphQL.
 */
export async function buildSubmissionPayload(
  responseData: GraphQLSubmissionStatusResponse,
  submissionId: string
): Promise<SubmissionPayload> {
  const domData = extractProblemFromDOM();
  const slug = extractSlugFromUrl() ?? 'unknown';

  // Fetch problem description and category in parallel with submission code
  const [problemDetails, code] = await Promise.all([
    fetchProblemDetails(slug),
    (async () => {
      if (responseData.code) return responseData.code;
      try {
        const id = submissionId || responseData.submission_id || '';
        if (id) return await fetchSubmissionCode(id);
      } catch (err) {
        log.warn('Failed to fetch submission code:', err);
      }
      return '';
    })(),
  ]);

  const problem: LeetCodeProblem = {
    titleSlug: slug,
    title: domData.title ?? slug,
    questionId: responseData.question_id ?? domData.questionId ?? 'unknown',
    difficulty: domData.difficulty ?? 'Easy',
    tags: domData.tags ?? [],
    categoryTitle: problemDetails.categoryTitle,
    descriptionHtml: problemDetails.descriptionHtml,
  };

  const submission: LeetCodeSubmission = {
    submissionId: submissionId || responseData.submission_id || 'unknown',
    language: responseData.lang ?? 'unknown',
    runtime: responseData.status_runtime ?? 'N/A',
    memory: responseData.status_memory ?? 'N/A',
    runtimePercentile: responseData.runtime_percentile,
    memoryPercentile: responseData.memory_percentile,
    timestamp: Date.now(),
    code: code || undefined,
  };

  const payload: SubmissionPayload = {
    problem,
    submission,
    capturedAt: new Date().toISOString(),
  };

  log.info('Built submission payload:', payload);
  return payload;
}
