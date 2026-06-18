import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { env } from '../config/env';

// Configuration for GitHub OAuth
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';

export const githubLogin = (req: Request, res: Response) => {
  if (!env.GITHUB_CLIENT_ID) {
    res.status(500).json({ success: false, error: 'GitHub OAuth not configured on server' });
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');

  // The extension passes its redirect_uri so we can forward it back after OAuth completes.
  // We carry it through GitHub's `state` param (as a JSON payload) since GitHub only
  // allows one redirect_uri per OAuth app registration.
  const extensionRedirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
  const statePayload = Buffer.from(JSON.stringify({ nonce: state, redirect_uri: extensionRedirectUri })).toString('base64url');

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/github/callback`,
    scope: 'read:user user:email repo',
    state: statePayload,
  });

  res.redirect(`${GITHUB_AUTH_URL}?${params.toString()}`);
};

export const githubCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, state } = req.query;

    if (!code) {
      res.status(400).json({ success: false, error: 'Authorization code missing' });
      return;
    }

    if (!state || typeof state !== 'string') {
      res.status(400).json({ success: false, error: 'Missing OAuth state parameter' });
      return;
    }

    // Decode the state payload we encoded in githubLogin
    let redirect_uri: string | undefined;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      redirect_uri = decoded.redirect_uri || undefined;
    } catch {
      res.status(400).json({ success: false, error: 'Invalid OAuth state parameter' });
      return;
    }

    // 1. Exchange code for GitHub Access Token
    const tokenResponse = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const githubToken = tokenResponse.data.access_token;
    if (!githubToken) {
      res.status(401).json({ success: false, error: 'Failed to retrieve GitHub access token' });
      return;
    }

    // 2. Fetch User Profile from GitHub
    const userResponse = await axios.get(GITHUB_USER_API, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    });

    const githubUser = userResponse.data;
    const githubId = githubUser.id.toString();
    const githubUsername = githubUser.login;
    
    // Attempt to get email (might be private, need a secondary API call, but we can allow null or use primary email)
    // For simplicity, we just use the login or an empty string if email is missing.
    const email = githubUser.email || `${githubUsername}@users.noreply.github.com`;

    // 3. Upsert User in Database
    // Check if user exists by githubId, if not check by email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { githubId },
          { email }
        ]
      }
    });

    if (user) {
      // Update existing user with latest github details
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId,
          githubUsername,
          githubToken, // In production, this should be encrypted at rest!
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          githubId,
          githubUsername,
          githubToken,
        },
      });
    }

    // 4. Generate Internal Session Tokens
    const accessToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshTokenString = crypto.randomBytes(32).toString('hex');
    
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenString,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // 5. Redirect back to the Extension
    // Prefer the redirect_uri the extension sent (dynamic, per-installation).
    // Fall back to FRONTEND_EXTENSION_URL from env (static production default).
    // If neither is present, show an informational HTML page (local dev only).
    const extensionRedirectUrl = redirect_uri || env.FRONTEND_EXTENSION_URL;

    if (!extensionRedirectUrl) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>LeetCommit Authentication</title>
          <style>
            body { background: #020617; color: #f8fafc; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; padding: 2rem; border-radius: 1rem; border: 1px solid #1e293b; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
            h1 { color: #818cf8; margin-top: 0; }
            .success { color: #34d399; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Authentication Successful!</h1>
            <p>You have successfully connected your GitHub account: <span class="success">@${githubUsername}</span></p>
            <p style="color: #94a3b8; font-size: 0.9rem;">Your backend database has permanently stored your user profile.</p>
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #1e293b;">
              <p style="color: #64748b; font-size: 0.8rem;">You can safely close this window and return to the extension.</p>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const redirectUrl = new URL(extensionRedirectUrl);
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshTokenString);
    redirectUrl.searchParams.set('username', githubUsername);

    res.redirect(redirectUrl.toString());

  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Refresh token is required' });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } }); // clean up
      }
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    // Generate new Access Token
    const accessToken = jwt.sign({ userId: storedToken.userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    // Optionally rotate the refresh token (delete old, issue new). 
    // Here we'll just keep the existing one until it expires.

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};
