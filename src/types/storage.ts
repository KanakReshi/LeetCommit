/**
 * Typed schema for browser.storage.local data.
 */

import type { SubmissionPayload } from './leetcode';

export interface StorageSchema {
  /** Whether auto-send is enabled */
  enabled: boolean;

  /** Backend API URL */
  apiUrl: string;

  /** OAuth Access Token */
  accessToken: string;

  /** OAuth Refresh Token */
  refreshToken: string;

  /** GitHub Username */
  githubUsername: string | null;

  /** Total submissions detected across all sessions */
  totalDetected: number;

  /** Total submissions successfully sent to the backend */
  totalSent: number;

  /** Total submissions that failed to send */
  totalFailed: number;

  /** The most recent submission payload */
  lastSubmission: SubmissionPayload | null;

  /** The last error message, if any */
  lastError: string | null;

  /** Queue of submissions that failed and are awaiting retry */
  failedQueue: SubmissionPayload[];

  /** Debug mode flag */
  debug: boolean;
}

/** Default values for a fresh install */
export const DEFAULT_STORAGE: StorageSchema = {
  enabled: true,
  apiUrl: 'http://localhost:3000', // Root backend URL for auth flows and APIs
  accessToken: '',
  refreshToken: '',
  githubUsername: null,
  totalDetected: 0,
  totalSent: 0,
  totalFailed: 0,
  lastSubmission: null,
  lastError: null,
  failedQueue: [],
  debug: false,
};
