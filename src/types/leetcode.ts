/**
 * LeetCode domain types.
 *
 * These model the data we extract from LeetCode's internal
 * GraphQL responses and the problem page DOM.
 */

/** Difficulty levels as surfaced by LeetCode */
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** Status values returned by submission-check queries */
export type SubmissionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Runtime Error'
  | 'Compile Error'
  | 'Output Limit Exceeded';

/** Minimal problem metadata */
export interface LeetCodeProblem {
  /** URL slug, e.g. "two-sum" */
  titleSlug: string;
  /** Human-readable title, e.g. "Two Sum" */
  title: string;
  /** Numeric ID on LeetCode */
  questionId: string;
  /** Difficulty level */
  difficulty: Difficulty;
  /** Topic tags, e.g. ["Array", "Hash Table"] */
  tags: string[];
  /** LeetCode category, e.g. "Algorithms", "Database", "Shell" */
  categoryTitle?: string;
  /** Raw HTML description from LeetCode's content field */
  descriptionHtml?: string;
}

/** Data extracted from an accepted submission response */
export interface LeetCodeSubmission {
  id: string;
  title: string;
  slug: string;
  language: string;
  code: string;
  status: number;
  runtime?: string;
  memory?: string;
  runtimePercentile?: number;
  memoryPercentile?: number;
  timestamp: number;
}

/** Combined payload sent to the backend API */
export interface SubmissionPayload {
  problem: LeetCodeProblem;
  submission: LeetCodeSubmission;
  /** ISO-8601 timestamp of when the extension captured it */
  capturedAt: string;
}

/**
 * Shape of the GraphQL response we intercept when LeetCode checks
 * submission status. This is a subset — we only model what we need.
 */
export interface GraphQLSubmissionCheckResponse {
  data?: {
    submissionDetails?: {
      statusCode: number;
      statusDisplay: string;
      lang: string;
      runtime: string;
      memory: string;
      user: string;
      question?: {
        questionId: string;
        title: string;
        titleSlug: string;
        difficulty: Difficulty;
      };
      code?: string;
      timestamp?: string;
    };
  };
}

/**
 * Shape of the GraphQL response from the /submissions/detail/ check
 * that LeetCode uses during polling for results.
 */
export interface GraphQLSubmissionStatusResponse {
  state: string;
  status_msg: string;
  status_runtime: string;
  status_memory: string;
  user?: string;
  /** Percentile beaten for runtime speed, e.g. 98.5 */
  runtime_percentile?: number;
  /** Percentile beaten for memory usage, e.g. 75.2 */
  memory_percentile?: number;
  lang: string;
  submission_id: string;
  question_id?: string;
  code_output?: string;
  total_correct?: number;
  total_testcases?: number;
  code?: string;
}
