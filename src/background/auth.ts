import { GITHUB_OAUTH } from '@/constants';

/**
 * GitHub's OAuth endpoints send no CORS headers, so requests must run in the
 * background script (privileged by host_permissions), not the popup page.
 * Form-encoded bodies are used to keep them as "simple" requests.
 */
function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// ── Device Flow ───────────────────────────────────────────────────────────────

export interface DeviceFlowInit {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** seconds before the device_code expires (usually 900) */
  expiresIn: number;
  /** minimum polling interval in seconds (usually 5) */
  interval: number;
}

/** Step 1 – request a device + user code pair from GitHub */
export async function initiateDeviceFlow(): Promise<DeviceFlowInit> {
  const res = await fetch(GITHUB_OAUTH.DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({ client_id: GITHUB_OAUTH.CLIENT_ID, scope: GITHUB_OAUTH.SCOPE }),
  });

  if (!res.ok) throw new Error(`GitHub device flow request failed: ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

// ── Poll result ───────────────────────────────────────────────────────────────

export type PollResult =
  | { status: 'pending' }
  | { status: 'slow_down' } // GitHub wants us to back off
  | { status: 'authorized'; token: string; username: string }
  | { status: 'expired' }
  | { status: 'error'; message: string };

/** Step 2 – poll until the user has authorized (or the code expires) */
export async function pollDeviceFlow(deviceCode: string): Promise<PollResult> {
  const res = await fetch(GITHUB_OAUTH.ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      client_id: GITHUB_OAUTH.CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  if (!res.ok) throw new Error(`GitHub token poll failed: ${res.status}`);

  const data = await res.json();

  if (data.access_token) {
    const username = await fetchGitHubUsername(data.access_token);
    return { status: 'authorized', token: data.access_token, username };
  }

  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'slow_down' };
    case 'expired_token':
      return { status: 'expired' };
    default:
      return {
        status: 'error',
        message: data.error_description ?? data.error ?? 'Unknown OAuth error',
      };
  }
}

// ── User info ─────────────────────────────────────────────────────────────────

/** Fetch the authenticated user's login name from the GitHub API */
export async function fetchGitHubUsername(token: string): Promise<string> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch GitHub user: ${res.status}`);

  const data = await res.json();
  return data.login as string;
}

// kept for backward-compat with scheduler.ts
export async function refreshSession(): Promise<string | undefined> {
  const { StorageService } = await import('../services/StorageService');
  return (await StorageService.getToken()).accessToken;
}
