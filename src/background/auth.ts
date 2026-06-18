import { StorageService } from '../services/StorageService';
import { createLogger } from '../utils/logger';

interface BrowserWithIdentity {
  identity: {
    getRedirectURL(): string;
    launchWebAuthFlow(options: { url: string; interactive?: boolean }): Promise<string>;
  };
}

const log = createLogger('AuthFlow');

/**
 * Initiates the GitHub OAuth flow via the extension API.
 *
 * 1. Retrieves the backend API URL.
 * 2. Launches the web auth flow pointing to our backend's /api/auth/github route.
 * 3. The backend completes the handshake, creates/updates the User, and redirects back
 *    to the extension URL with the new JWT access and refresh tokens.
 */
export async function loginWithGithub(): Promise<void> {
  try {
    const tokenConfig = await StorageService.getToken();
    const backendUrl = tokenConfig.apiUrl || 'http://localhost:3000';
    const authUrl = `${backendUrl}/api/auth/github`;

    // browser.identity.getRedirectURL() returns the expected redirect URI for this extension
    // e.g., https://<extension-id>.extensions.allizom.org/
    const browserIdentity = (browser as unknown as BrowserWithIdentity).identity;
    const redirectUri = browserIdentity.getRedirectURL();
    log.debug('Extension redirect URI:', redirectUri);

    // Ensure the backend knows where to redirect back by appending it as a query param
    // (Wait, the backend currently expects FRONTEND_EXTENSION_URL from .env, but dynamic is better)
    // For now, we assume the backend knows or we can append it:
    const finalAuthUrl = `${authUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;

    log.info('Launching web auth flow to:', finalAuthUrl);

    const responseUrl = await browserIdentity.launchWebAuthFlow({
      url: finalAuthUrl,
      interactive: true,
    });

    log.debug('Auth flow completed, parsing response:', responseUrl);

    const url = new URL(responseUrl);
    const accessToken = url.searchParams.get('accessToken');
    const refreshToken = url.searchParams.get('refreshToken');
    const username = url.searchParams.get('username');

    if (accessToken && refreshToken) {
      await StorageService.updateToken({
        accessToken,
        refreshToken,
        githubUsername: username,
      });
      log.info(`Successfully logged in as GitHub user: ${username}`);
    } else {
      throw new Error('Tokens missing from auth redirect callback');
    }
  } catch (error) {
    log.error('GitHub authentication failed:', error);
    throw error;
  }
}

/**
 * Automatically refreshes the access token if the backend returns a 401 Unauthorized.
 *
 * Returns the new access token if successful, or throws an error if the refresh token
 * is invalid or expired.
 */
export async function refreshSession(): Promise<string> {
  try {
    const tokenConfig = await StorageService.getToken();
    if (!tokenConfig.refreshToken) {
      throw new Error('No refresh token available');
    }

    const backendUrl = tokenConfig.apiUrl || 'http://localhost:3000';

    const response = await fetch(`${backendUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokenConfig.refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to refresh token');
    }

    const json = await response.json();
    const newAccessToken = json.data.accessToken;

    await StorageService.updateToken({ accessToken: newAccessToken });
    log.info('Successfully refreshed session token');

    return newAccessToken;
  } catch (error) {
    log.error('Session refresh failed:', error);
    // Clear tokens if refresh failed so user is prompted to log in again
    await StorageService.updateToken({ accessToken: '', refreshToken: '', githubUsername: null });
    throw error;
  }
}
