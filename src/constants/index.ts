/**
 * Application-wide constants.
 */

/** LeetCode URL patterns */
export const LEETCODE = {
  /** Base URL */
  BASE_URL: 'https://leetcode.com',

  /** GraphQL endpoint intercepted by the content script */
  GRAPHQL_ENDPOINT: '/graphql',

  /** Submission check endpoint (REST polling) */
  SUBMISSION_CHECK_PREFIX: '/submissions/detail/',

  /** URL pattern for problem pages */
  PROBLEM_URL_PATTERN: /^https:\/\/leetcode\.com\/problems\/([a-z0-9-]+)/,

  /** URL pattern for problem list */
  PROBLEMSET_URL_PATTERN: /^https:\/\/leetcode\.com\/problemset\b/,

  /** URL pattern for contest pages */
  CONTEST_URL_PATTERN: /^https:\/\/leetcode\.com\/contest\b/,
} as const;

/** Storage keys matching StorageSchema */
export const STORAGE_KEYS = {
  ENABLED: 'enabled',
  API_URL: 'apiUrl',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  TOTAL_DETECTED: 'totalDetected',
  TOTAL_SENT: 'totalSent',
  TOTAL_FAILED: 'totalFailed',
  LAST_SUBMISSION: 'lastSubmission',
  LAST_ERROR: 'lastError',
  FAILED_QUEUE: 'failedQueue',
  DEBUG: 'debug',
} as const;

/** Retry configuration for the submitter */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
} as const;

/** HTTP request configuration */
export const HTTP_CONFIG = {
  TIMEOUT_MS: 10000,
  CONTENT_TYPE: 'application/json',
} as const;

/** Extension metadata */
export const EXTENSION = {
  NAME: 'LeetCommit',
  VERSION: '1.0.0',
} as const;

/**
 * GitHub OAuth – Device Flow (no backend / no client_secret needed).
 *
 * How to get a CLIENT_ID:
 *   1. Go to https://github.com/settings/developers → "New OAuth App"
 *   2. Set any Homepage URL and Callback URL (they are unused for device flow)
 *   3. After creation, enable "Device Flow" on the app settings page
 *   4. Copy the Client ID and paste it below
 */
export const GITHUB_OAUTH = {
  CLIENT_ID: 'Ov23liYRPjjNNnw4WDJG',
  SCOPE: 'repo',
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  ACCESS_TOKEN_URL: 'https://github.com/login/oauth/access_token',
  DEFAULT_REPO: 'LeetCode-Solutions',
} as const;
