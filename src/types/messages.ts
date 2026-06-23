import type { SubmissionPayload } from './leetcode';
import type { GitHubConfig } from './github';

export type ExtensionMessage =
  | {
      type: 'SUBMISSION_ACCEPTED';
      payload: SubmissionPayload;
    }
  | {
      type: 'GET_STATUS';
    }
  | {
      type: 'GET_CONFIG';
    }
  | {
      type: 'UPDATE_CONFIG';
      payload: {
        github?: GitHubConfig;
        enabled?: boolean;
      };
    }
  | {
      type: 'RETRY_FAILED';
    }
  | {
      type: 'LOGOUT';
    }

  /**
   * Kick off GitHub Device Flow. The background returns the codes to show the
   * user AND starts polling on its own (so auth completes even if the popup
   * closes). The chosen repo is passed in so the background can save the full
   * config once the token arrives.
   */
  | { type: 'GITHUB_OAUTH_START'; payload: { repo: string } };

export type ExtensionResponse =
  | {
      type: 'OK';
      message?: string;
    }
  | {
      type: 'ERROR';
      message: string;
    }
  | {
      type: 'STATUS_RESPONSE';

      payload: {
        totalDetected: number;
        totalSent: number;
        totalFailed: number;

        lastSubmission: SubmissionPayload | null;

        lastError: string | null;

        enabled: boolean;
      };
    }
  | {
      type: 'CONFIG_RESPONSE';

      payload: {
        github: GitHubConfig | null;

        enabled: boolean;
      };
    }

  /** Codes returned after GITHUB_OAUTH_START */
  | {
      type: 'OAUTH_DEVICE_RESPONSE';
      payload: {
        deviceCode: string;
        userCode: string;
        verificationUri: string;
        interval: number;
        expiresIn: number;
      };
    };
