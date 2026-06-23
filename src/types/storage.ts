import type { SubmissionPayload } from './leetcode';
import type { GitHubConfig } from './github';

/** In-progress GitHub Device Flow state, persisted so it survives the popup closing. */
export interface OAuthPending {
  repo: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
}

export interface StorageSchema {
  enabled: boolean;

  github: GitHubConfig | null;

  /** Set while a device-flow login is running; cleared on success/failure. */
  oauthPending: OAuthPending | null;

  /** Last OAuth failure message, shown by the login UI. */
  oauthError: string | null;

  totalDetected: number;

  totalSent: number;

  totalFailed: number;

  lastSubmission: SubmissionPayload | null;

  lastError: string | null;

  failedQueue: SubmissionPayload[];

  debug: boolean;
}

export const DEFAULT_STORAGE: StorageSchema = {
  enabled: true,

  github: null,

  oauthPending: null,

  oauthError: null,

  totalDetected: 0,

  totalSent: 0,

  totalFailed: 0,

  lastSubmission: null,

  lastError: null,

  failedQueue: [],

  debug: false,
};
