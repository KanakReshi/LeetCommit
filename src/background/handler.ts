/**
 * Message handler for the background service worker.
 *
 * Routes incoming messages by their `type` discriminant
 * to the appropriate handler function.
 */

import type { ExtensionMessage, ExtensionResponse } from '@/types/messages';
import type { SubmissionPayload } from '@/types/leetcode';
import { submitToBackend, retryFailed } from './submitter';
import { loginWithGithub } from './auth';
import { getStorage, setStorage } from '@/utils/storage';
import { StorageService } from '@/services/StorageService';
import { createLogger } from '@/utils/logger';

const log = createLogger('Handler');

/**
 * Handle an incoming message and return a response.
 */
export async function handleMessage(
  message: ExtensionMessage,
  _sender: browser.runtime.MessageSender
): Promise<ExtensionResponse> {
  log.info('Received message:', message.type);

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

    case 'LOGIN_WITH_GITHUB':
      return handleLoginWithGithub();

    case 'LOGOUT':
      return handleLogout();

    case 'TEST_CONNECTION':
      return handleTestConnection();

    default: {
      // Exhaustiveness check
      const _exhaustive: never = message;
      log.warn('Unknown message type:', _exhaustive);
      return { type: 'ERROR', message: 'Unknown message type' };
    }
  }
}

// ── Handlers ─────────────────────────────────────────────────────

async function handleSubmissionAccepted(payload: SubmissionPayload): Promise<ExtensionResponse> {
  try {
    await submitToBackend(payload);
    return { type: 'OK', message: 'Submission processed' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Error processing submission:', msg);
    return { type: 'ERROR', message: msg };
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
    payload: {
      totalDetected: data.totalDetected,
      totalSent: data.totalSent,
      totalFailed: data.totalFailed,
      lastSubmission: data.lastSubmission,
      lastError: data.lastError,
      enabled: data.enabled,
    },
  };
}

async function handleGetConfig(): Promise<ExtensionResponse> {
  const [tokenConfig, { enabled }] = await Promise.all([
    StorageService.getToken(),
    getStorage(['enabled']),
  ]);

  return {
    type: 'CONFIG_RESPONSE',
    payload: {
      apiUrl: tokenConfig.apiUrl,
      accessToken: tokenConfig.accessToken,
      enabled,
    },
  };
}

async function handleUpdateConfig(
  updates: Partial<{ apiUrl: string; accessToken: string; enabled: boolean }>
): Promise<ExtensionResponse> {
  const { enabled, ...tokenUpdates } = updates;
  if (Object.keys(tokenUpdates).length > 0) {
    await StorageService.updateToken(tokenUpdates);
  }
  if (enabled !== undefined) {
    await setStorage({ enabled });
  }
  log.info('Config updated:', Object.keys(updates));
  return { type: 'OK', message: 'Config updated' };
}

async function handleRetryFailed(): Promise<ExtensionResponse> {
  try {
    const retried = await retryFailed();
    return { type: 'OK', message: `Retried ${retried} failed submissions` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { type: 'ERROR', message: msg };
  }
}

async function handleLoginWithGithub(): Promise<ExtensionResponse> {
  try {
    await loginWithGithub();
    const token = await StorageService.getToken();
    return { type: 'OK', message: token.githubUsername ?? 'Logged in' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Login failed';
    log.error('GitHub login failed:', msg);
    return { type: 'ERROR', message: msg };
  }
}

async function handleLogout(): Promise<ExtensionResponse> {
  await StorageService.updateToken({ accessToken: '', refreshToken: '', githubUsername: null });
  log.info('User logged out');
  return { type: 'OK', message: 'Logged out' };
}

async function handleTestConnection(): Promise<ExtensionResponse> {
  try {
    const tokenConfig = await StorageService.getToken();
    const apiUrl = tokenConfig.apiUrl || 'http://localhost:3000';
    const healthUrl = `${apiUrl.replace(/\/$/, '')}/health`;

    log.info('Testing connection to:', healthUrl);

    const res = await fetch(healthUrl, { method: 'GET' });
    if (res.ok) {
      const body = await res.json();
      return { type: 'OK', message: `Backend reachable at ${apiUrl} (${body.status ?? 'ok'})` };
    }
    return { type: 'ERROR', message: `Backend returned ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Connection test failed:', message);
    return { type: 'ERROR', message: `Cannot reach backend: ${message}` };
  }
}
