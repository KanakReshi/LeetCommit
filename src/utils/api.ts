/**
 * Backend API client.
 *
 * Sends submission payloads to the configured endpoint
 * with timeout handling and structured error reporting.
 */

import type { SubmissionPayload } from '@/types/leetcode';
import { HTTP_CONFIG } from '@/constants';
import { createLogger } from './logger';

const log = createLogger('ApiClient');

export interface ApiConfig {
  apiUrl: string;
  accessToken: string;
}

export interface ApiResult {
  success: boolean;
  statusCode?: number;
  message: string;
}

/**
 * POST a submission payload to the backend API.
 */
export async function sendSubmission(
  payload: SubmissionPayload,
  config: ApiConfig
): Promise<ApiResult> {
  const { apiUrl, accessToken } = config;

  if (!apiUrl) {
    return { success: false, message: 'API URL is not configured.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_CONFIG.TIMEOUT_MS);

  const url = `${apiUrl.replace(/\/$/, '')}/api/submissions`;

  try {
    log.info('Sending submission to', url);

    const headers: Record<string, string> = {
      'Content-Type': HTTP_CONFIG.CONTENT_TYPE,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.ok) {
      log.info('Submission sent successfully:', response.status);
      return {
        success: true,
        statusCode: response.status,
        message: `Sent successfully (${response.status})`,
      };
    }

    const errorBody = await response.text().catch(() => 'Unknown error');
    log.error('API responded with error:', response.status, errorBody);
    return {
      success: false,
      statusCode: response.status,
      message: `API error ${response.status}: ${errorBody.slice(0, 200)}`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log.error('Request timed out after', HTTP_CONFIG.TIMEOUT_MS, 'ms');
      return { success: false, message: `Request timed out after ${HTTP_CONFIG.TIMEOUT_MS}ms` };
    }

    const message = error instanceof Error ? error.message : 'Unknown network error';
    log.error('Network error:', message);
    return { success: false, message };
  } finally {
    clearTimeout(timeoutId);
  }
}
