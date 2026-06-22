# Deploying LeetCommit to Mozilla Add-ons

> No local server required. This guide covers deploying the backend to a hosted service and submitting the extension to AMO.

---

## Why Not Hugging Face Spaces?

Hugging Face Spaces is built for ML demos — it is **not suitable** for this backend:

| Problem | Impact |
|---|---|
| Spaces sleep after ~15 min of inactivity | OAuth callback fails if Space is cold |
| No native PostgreSQL service | Needs a separate DB host anyway |
| Not designed for persistent REST APIs | Rate limits, no SLA |

---

## Recommended Free Hosting Stack

| Component | Where it runs | Cost |
|---|---|---|
| Extension JS/HTML | User's browser | Free |
| Backend API (Node.js + Docker) | **Render.com** or **Fly.io** | Free tier |
| PostgreSQL database | **Neon.tech** | Free tier (serverless Postgres) |
| GitHub commits | GitHub API via backend | Free |
| Mozilla AMO hosting | Mozilla CDN | Free |

Both Render and Fly support Docker and have free tiers. The backend already has a `Dockerfile` so either works out of the box.

---

## Step 1: Set Up PostgreSQL on Neon

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project → copy the **connection string**, e.g.:
   ```
   postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Run migrations once locally pointing at Neon:
   ```bash
   DATABASE_URL="<neon connection string>" npx prisma migrate deploy
   ```

---

## Step 2: Set Up GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

- **Homepage URL:** `https://your-app.onrender.com` (or your Fly.io URL)
- **Authorization callback URL:** `https://your-app.onrender.com/api/auth/github/callback`

Save the **Client ID** and **Client Secret** for the next step.

---

## Step 3: Deploy the Backend

Choose one option — both use the existing `backend/Dockerfile`.

### Option A — Render.com (easier setup)

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo, set **Root Directory** to `backend/`
3. Render auto-detects the Dockerfile
4. Set environment variables:

```env
DATABASE_URL=<neon connection string>
JWT_SECRET=<strong random string, min 16 chars>
GITHUB_CLIENT_ID=<from step 2>
GITHUB_CLIENT_SECRET=<from step 2>
NODE_ENV=production
JWT_EXPIRES_IN=7d
PORT=3000
```

5. Deploy — your URL will be `https://your-app.onrender.com`

> **Note:** Render free tier spins down after 15 min of inactivity (same as HuggingFace). To avoid cold-start delays on OAuth callbacks, use a free uptime monitor like [UptimeRobot](https://uptimerobot.com) to ping `/health` every 10 minutes.

---

### Option B — Fly.io (no sleep, better for production)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

cd backend/

# Launch app (follow prompts, pick a region close to your users)
fly launch

# Set secrets
fly secrets set \
  DATABASE_URL="<neon connection string>" \
  JWT_SECRET="<strong random string>" \
  GITHUB_CLIENT_ID="<from step 2>" \
  GITHUB_CLIENT_SECRET="<from step 2>" \
  NODE_ENV=production \
  JWT_EXPIRES_IN=7d

# Deploy
fly deploy
```

Your URL will be `https://your-app.fly.dev`. Fly's free tier does **not** sleep.

---

## Step 4: Point the Extension to Your Deployed Backend

Update the API base URL in your extension's constants to your Render or Fly URL, then rebuild:

```bash
npm run build
```

Also update `manifest.json` host permissions to include your new domain:

```json
"host_permissions": [
  "https://leetcode.com/*",
  "https://your-app.onrender.com/*"
]
```

---

## Step 5: Package the Extension

```bash
zip -r leetcommit-1.0.2.zip dist/ manifest.json public/icons/
```

Prepare a source ZIP for AMO's mandatory source review:

```bash
zip -r leetcommit-source.zip src/ backend/ package.json vite.config.ts tsconfig.json manifest.json
```

---

## Step 6: Submit to Mozilla Add-ons (AMO)

1. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/)
2. Sign in with your Firefox account
3. Click **Submit a New Add-on** → **On this site**
4. Upload `leetcommit-1.0.2.zip`
5. AMO validates the manifest and permissions automatically
6. Fill in: name, description, screenshots, category (**Tools**)
7. Upload `leetcommit-source.zip` under **Source Code** (required for minified/bundled code)
8. Add build instructions in the **Notes to Reviewer** field:

```
Build instructions:
1. npm install
2. npm run build
Output is in the dist/ folder, matching the submitted ZIP.
Backend runs separately on Render/Fly — see backend/README.md.
```

9. Submit for review — AMO editorial review typically takes **1–7 days**

---

## Notes

- **Token security:** `User.githubToken` is currently stored in plain text in the DB. Encrypt it at rest before a public release.
- **Scaling:** Neon free tier has 0.5 GB storage and branches to zero when idle — fine for early users, upgrade when you grow.
- **AMO re-submission:** Every extension update requires a new AMO submission. Consider a `scripts/package.mjs` to automate the ZIP creation.
