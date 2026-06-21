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

import { retryFailed, submitSubmission } from './submitter';

import { getStorage, setStorage } from '@/utils/storage';

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

    default:
      const _exhaustive: never = message;

      return {
        type: 'ERROR',

        message: `Unknown message ${_exhaustive}`,
      };
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

async function handleUpdateConfig(updates: any): Promise<ExtensionResponse> {
  await setStorage(updates);

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
