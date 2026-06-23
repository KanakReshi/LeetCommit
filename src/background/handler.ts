/**
 * Background message handler.
 *
 * Handles:
 * - GitHub config
 * - submission sync
 * - retry queue
 * - local storage
 */

import type { ExtensionMessage, ExtensionResponse } from '@/types/messages';
import type { SubmissionPayload } from '@/types/leetcode';
import type { StorageSchema } from '@/types/storage';

import { retryFailed, submitSubmission } from './submitter';
import { initiateDeviceFlow, pollDeviceFlow } from './auth';

import { getStorage, setStorage } from '@/utils/storage';
import { GITHUB_OAUTH } from '@/constants';

import { createLogger } from '@/utils/logger';

const log = createLogger('Handler');

export async function handleMessage(
  message: ExtensionMessage,
  _sender: browser.runtime.MessageSender
): Promise<ExtensionResponse> {
  log.info('Received:', message.type);

  switch (message.type) {
    case 'SUBMISSION_ACCEPTED':
      return handleSubmissionAccepted(message.payload);

    case 'GET_STATUS':
      return handleGetStatus();

    case 'GET_CONFIG':
      return handleGetConfig();

    case 'UPDATE_CONFIG':
      return handleUpdateConfig(message.payload);

    case 'RETRY_FAILED':
      return handleRetryFailed();

    case 'LOGOUT':
      return handleLogout();

    case 'GITHUB_OAUTH_START':
      return handleGithubOAuthStart(message.payload.repo);

    default: {
      const _exhaustive: string = message;

      return {
        type: 'ERROR',

        message: `Unknown message ${_exhaustive}`,
      };
    }
  }
}

async function handleSubmissionAccepted(payload: SubmissionPayload): Promise<ExtensionResponse> {
  try {
    await submitSubmission(payload);

    return {
      type: 'OK',

      message: 'Submission processed',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';

    log.error(msg);

    return {
      type: 'ERROR',

      message: msg,
    };
  }
}

async function handleGetStatus(): Promise<ExtensionResponse> {
  const data = await getStorage([
    'totalDetected',
    'totalSent',
    'totalFailed',
    'lastSubmission',
    'lastError',
    'enabled',
  ]);

  return {
    type: 'STATUS_RESPONSE',

    payload: data,
  };
}

async function handleGetConfig(): Promise<ExtensionResponse> {
  const data = await getStorage(['github', 'enabled']);

  return {
    type: 'CONFIG_RESPONSE',

    payload: {
      github: data.github,

      enabled: data.enabled,
    },
  };
}

async function handleUpdateConfig(updates: unknown): Promise<ExtensionResponse> {
  await setStorage(updates as Partial<StorageSchema>);

  log.info('Config updated');

  return {
    type: 'OK',

    message: 'Config saved',
  };
}

async function handleRetryFailed(): Promise<ExtensionResponse> {
  try {
    const retried = await retryFailed();

    return {
      type: 'OK',

      message: `Retried ${retried} submissions`,
    };
  } catch (error) {
    return {
      type: 'ERROR',

      message: error instanceof Error ? error.message : 'Retry failed',
    };
  }
}

async function handleLogout(): Promise<ExtensionResponse> {
  await setStorage({
    github: null,
  });

  return {
    type: 'OK',

    message: 'GitHub disconnected',
  };
}

async function handleGithubOAuthStart(repo: string): Promise<ExtensionResponse> {
  try {
    const init = await initiateDeviceFlow();

    // Persist the in-progress state so the popup can restore it if reopened.
    await setStorage({
      oauthPending: {
        repo,
        deviceCode: init.deviceCode,
        userCode: init.userCode,
        verificationUri: init.verificationUri,
        interval: init.interval,
      },
      oauthError: null,
    });

    // Poll in the background (fire-and-forget) so login completes even after
    // the popup closes when the user switches to the GitHub tab.
    void runDeviceFlowPolling(init.deviceCode, init.interval, init.expiresIn, repo);

    return {
      type: 'OAUTH_DEVICE_RESPONSE',
      payload: {
        deviceCode: init.deviceCode,
        userCode: init.userCode,
        verificationUri: init.verificationUri,
        interval: init.interval,
        expiresIn: init.expiresIn,
      },
    };
  } catch (error) {
    return {
      type: 'ERROR',
      message: error instanceof Error ? error.message : 'Failed to start GitHub auth',
    };
  }
}

/**
 * Polls GitHub until the user authorizes, then writes the GitHub config to
 * storage. Both the popup and the dashboard react to that storage write.
 */
async function runDeviceFlowPolling(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  repo: string
): Promise<void> {
  const deadline = Date.now() + expiresIn * 1000;
  let waitMs = interval * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Stop if the user cancelled (pending cleared) or started a new flow.
    const { oauthPending } = await getStorage('oauthPending');
    if (!oauthPending || oauthPending.deviceCode !== deviceCode) return;

    let result;
    try {
      result = await pollDeviceFlow(deviceCode);
    } catch (error) {
      await setStorage({
        oauthError: error instanceof Error ? error.message : 'Polling failed',
        oauthPending: null,
      });
      return;
    }

    if (result.status === 'authorized') {
      await setStorage({
        github: {
          username: result.username,
          token: result.token,
          repo: repo || GITHUB_OAUTH.DEFAULT_REPO,
          branch: 'main',
        },
        enabled: true,
        oauthPending: null,
        oauthError: null,
      });
      log.info('GitHub OAuth complete for', result.username);
      return;
    }

    if (result.status === 'slow_down') {
      waitMs += 5000;
      continue;
    }

    if (result.status === 'expired') {
      await setStorage({ oauthError: 'Code expired. Please try again.', oauthPending: null });
      return;
    }

    if (result.status === 'error') {
      await setStorage({ oauthError: result.message, oauthPending: null });
      return;
    }

    // status === 'pending' → keep polling
  }

  await setStorage({
    oauthError: 'Authorization timed out. Please try again.',
    oauthPending: null,
  });
}
