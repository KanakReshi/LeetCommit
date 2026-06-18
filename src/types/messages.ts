/**
 * Extension messaging protocol types.
 *
 * Uses a discriminated union so the background handler can
 * exhaustively switch on `message.type`.
 */

import type { SubmissionPayload } from './leetcode';
import type { StorageSchema } from './storage';

// ── Inbound messages (content → background, popup → background) ──

export interface SubmissionAcceptedMessage {
  type: 'SUBMISSION_ACCEPTED';
  payload: SubmissionPayload;
}

export interface GetStatusMessage {
  type: 'GET_STATUS';
}

export interface GetConfigMessage {
  type: 'GET_CONFIG';
}

export interface UpdateConfigMessage {
  type: 'UPDATE_CONFIG';
  payload: Partial<Pick<StorageSchema, 'apiUrl' | 'accessToken' | 'enabled'>>;
}

export interface RetryFailedMessage {
  type: 'RETRY_FAILED';
}

export interface LoginWithGithubMessage {
  type: 'LOGIN_WITH_GITHUB';
}

export interface LogoutMessage {
  type: 'LOGOUT';
}

export interface TestConnectionMessage {
  type: 'TEST_CONNECTION';
}

// ── Outbound responses (background → popup) ──

export interface StatusResponse {
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

export interface ConfigResponse {
  type: 'CONFIG_RESPONSE';
  payload: {
    apiUrl: string;
    accessToken: string;
    enabled: boolean;
  };
}

export interface GenericResponse {
  type: 'OK' | 'ERROR';
  message?: string;
}

// ── Union type ──

export type ExtensionMessage =
  | SubmissionAcceptedMessage
  | GetStatusMessage
  | GetConfigMessage
  | UpdateConfigMessage
  | RetryFailedMessage
  | LoginWithGithubMessage
  | LogoutMessage
  | TestConnectionMessage;

export type ExtensionResponse = StatusResponse | ConfigResponse | GenericResponse;
