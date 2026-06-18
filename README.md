# LeetCommit

> Automatically detect accepted LeetCode submissions, sync your progress to a personal dashboard, and push every solution directly to your GitHub — all from a Firefox extension.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Part 1 — Backend Setup](#part-1--backend-setup)
  - [1.1 Clone & Install](#11-clone--install)
  - [1.2 Create a GitHub OAuth App](#12-create-a-github-oauth-app)
  - [1.3 Configure Environment Variables](#13-configure-environment-variables)
  - [1.4 Start the Database](#14-start-the-database)
  - [1.5 Run Database Migrations](#15-run-database-migrations)
  - [1.6 Start the Backend Server](#16-start-the-backend-server)
- [Part 2 — Extension Setup](#part-2--extension-setup)
  - [2.1 Install Extension Dependencies](#21-install-extension-dependencies)
  - [2.2 Build the Extension](#22-build-the-extension)
  - [2.3 Load into Firefox](#23-load-into-firefox)
- [Part 3 — First-Time Login](#part-3--first-time-login)
- [Part 4 — Using the Extension](#part-4--using-the-extension)
  - [Solving a Problem](#solving-a-problem)
  - [The Dashboard](#the-dashboard)
- [Development Workflow](#development-workflow)
- [API Reference](#api-reference)
- [Scripts Reference](#scripts-reference)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## What It Does

LeetCommit is a Firefox extension + backend system that makes your LeetCode grind visible and actionable.

```
You solve a problem on LeetCode
        │
        ▼
Extension detects "Accepted" (via XHR intercept)
        │
        ▼
Submission data sent to your backend
        │
        ├──► Stored in PostgreSQL database
        │
        └──► Solution code pushed to GitHub repo
                  (LeetCode-Solutions/Array/Two-Sum.py)
```

**Features at a glance:**

| Feature | Description |
|---|---|
| Auto-detection | Intercepts LeetCode's internal polling API — no button clicks needed |
| GitHub sync | Pushes solution code to a `LeetCode-Solutions` repo automatically |
| Dashboard popup | Streak, solved count, topic breakdown, daily activity chart |
| Smart recommendations | Detects weak topics and suggests next steps |
| Offline queue | Failed submissions are queued and retried with exponential backoff |
| Token refresh | Access tokens are refreshed automatically on 401 — no re-login needed |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Firefox Browser                       │
│                                                          │
│  ┌──────────────────────────┐                           │
│  │  leetcode.com/problems/* │                           │
│  │                          │                           │
│  │  content/detector.ts     │  XHR / fetch intercept   │
│  │  → watches submission    │  detects "Accepted"       │
│  │    polling endpoint      │                           │
│  │                          │                           │
│  │  content/extractor.ts    │                           │
│  │  → scrapes title,        │                           │
│  │    difficulty, tags      │                           │
│  └────────────┬─────────────┘                           │
│               │ browser.runtime.sendMessage              │
│               ▼                                         │
│  ┌──────────────────────────┐                           │
│  │    Background Worker     │                           │
│  │                          │                           │
│  │  handler.ts              │                           │
│  │  → routes messages       │                           │
│  │                          │                           │
│  │  submitter.ts            │  POST /api/submissions    │
│  │  → retry queue           │ ─────────────────────────┼──►
│  │  → token refresh         │                           │
│  │                          │                           │
│  │  scheduler.ts            │  POST /api/snapshots      │
│  │  → 24h snapshot sync     │ ─────────────────────────┼──►
│  └──────────────────────────┘                           │
│                                                          │
│  ┌──────────────────────────┐                           │
│  │     Popup Dashboard      │                           │
│  │   (React + Tailwind)     │                           │
│  │                          │                           │
│  │  Overview  │  Topics     │                           │
│  │  Analytics │  Tips       │                           │
│  │  Status                  │                           │
│  └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │      Backend API         │
         │   (Express + TypeScript) │
         │                          │
         │  POST /api/submissions   │──► PostgreSQL
         │  POST /api/snapshots     │──► PostgreSQL
         │  GET  /api/analytics     │◄── PostgreSQL
         │  GET  /api/auth/github   │
         │  GET  /api/auth/callback │──► GitHub OAuth
         │  POST /api/auth/refresh  │
         └──────────────┬───────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  GitHub API     │
              │  (Octokit)      │
              │                 │
              │  Creates repo   │
              │  Commits code   │
              │  per solution   │
              └─────────────────┘
```
---

## Project Structure

```
LeetCommit/
│
├── manifest.json              # Firefox MV3 extension manifest
├── vite.config.ts             # Multi-entry Vite build config
├── tsconfig.json              # TypeScript config (strict)
├── tailwind.config.js         # Tailwind CSS config
├── docker-compose.yml         # PostgreSQL + backend (dev)
├── docker-compose.prod.yml    # Production Docker setup
├── .env.example               # Extension environment template
│
├── src/                       # Extension source code
│   │
│   ├── types/                 # All TypeScript interfaces
│   │   ├── leetcode.ts        # LeetCodeProblem, SubmissionPayload, etc.
│   │   ├── messages.ts        # IPC message protocol (discriminated union)
│   │   ├── storage.ts         # StorageSchema + defaults
│   │   ├── navigation.ts      # PageContext, PageType
│   │   └── global.d.ts        # browser.* API declarations
│   │
│   ├── constants/
│   │   └── index.ts           # LEETCODE URLs, RETRY_CONFIG, HTTP_CONFIG
│   │
│   ├── utils/
│   │   ├── logger.ts          # Namespaced console logger
│   │   ├── storage.ts         # Typed browser.storage.local helpers
│   │   └── api.ts             # HTTP client (sendSubmission)
│   │
│   ├── services/
│   │   ├── StorageService.ts  # Auth token + settings CRUD (source of truth)
│   │   └── LeetCodeGraphQLService.ts  # LeetCode GraphQL queries + cache
│   │
│   ├── content/               # Injected into leetcode.com pages
│   │   ├── index.ts           # Entry point — bootstraps navigator + detector
│   │   ├── detector.ts        # Monkey-patches XHR + fetch to catch submissions
│   │   ├── extractor.ts       # Builds SubmissionPayload from DOM + response
│   │   ├── navigator.ts       # SPA navigation detector (History API + MutationObserver)
│   │   ├── dom-observer.ts    # DOM fallback for "Accepted" detection
│   │   ├── scraper.ts         # Full page scraper (title, difficulty, code)
│   │   └── emitter.ts         # Typed event emitter
│   │
│   ├── background/            # Service worker (runs in background)
│   │   ├── index.ts           # Entry point — registers all listeners
│   │   ├── handler.ts         # Message router
│   │   ├── submitter.ts       # Retry queue + exponential backoff
│   │   ├── auth.ts            # GitHub OAuth + token refresh
│   │   └── scheduler.ts       # 24h alarm for snapshot sync
│   │
│   └── popup/                 # Extension popup UI
│       ├── popup.html         # HTML shell
│       ├── main.tsx           # React root
│       ├── App.tsx            # Router + auto-sync on open
│       ├── popup.css          # Base styles + Tailwind
│       ├── pages/
│       │   ├── OverviewPage.tsx       # Streak + total solved
│       │   ├── TopicsPage.tsx         # Topic chart + weaknesses
│       │   ├── AnalyticsPage.tsx      # Activity + difficulty charts
│       │   ├── RecommendationsPage.tsx# AI-style tips
│       │   └── SyncStatusPage.tsx     # Status + force sync
│       └── components/
│           ├── layout/
│           │   └── DashboardLayout.tsx  # Sidebar navigation
│           └── charts/
│               ├── ActivityChart.tsx    # Area chart (recharts)
│               ├── DifficultyChart.tsx  # Pie chart (recharts)
│               └── TopicChart.tsx       # Horizontal bar chart (recharts)
│
└── backend/                   # Node.js API server
    ├── .env.example           # Backend environment template
    ├── Dockerfile
    ├── Dockerfile.dev
    ├── tsconfig.json
    │
    ├── prisma/
    │   └── schema.prisma      # DB schema: User, Problem, Submission, Snapshot, etc.
    │
    ├── scripts/
    │   └── migrate-repo.ts    # One-time GitHub repo migration helper
    │
    └── src/
        ├── server.ts          # Express server entry point
        ├── app.ts             # Express app + middleware setup
        │
        ├── config/
        │   └── env.ts         # Zod-validated environment variables
        │
        ├── controllers/
        │   ├── auth.controller.ts       # register, login
        │   ├── oauth.controller.ts      # githubLogin, githubCallback, refreshToken
        │   ├── submissions.controller.ts# saveSubmission, listSubmissions
        │   ├── snapshots.controller.ts  # saveSnapshot, listSnapshots
        │   └── analytics.controller.ts  # getDashboardAnalytics
        │
        ├── middlewares/
        │   ├── auth.ts          # JWT requireAuth middleware
        │   ├── validate.ts      # Zod request validation
        │   └── errorHandler.ts  # Global error + 404 handler
        │
        ├── routes/
        │   ├── auth.routes.ts
        │   ├── submissions.routes.ts
        │   ├── snapshots.routes.ts
        │   └── analytics.routes.ts
        │
        ├── services/
        │   ├── github.service.ts        # Octokit: create repo, commit file
        │   ├── analytics.service.ts     # Streak, growth, daily activity (raw SQL)
        │   ├── weakness.service.ts      # Weakest topic detection
        │   └── recommendation.service.ts# Advice generation
        │
        └── utils/
            ├── prisma.ts        # Prisma client singleton
            ├── logger.ts        # Pino structured logger
            └── languageMap.ts   # Language → file extension mapping
```

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 18.0.0 | `node --version` |
| npm | ≥ 9.0.0 | `npm --version` |
| Docker + Docker Compose | any recent | `docker --version` |
| Firefox | any recent | — |
| Git | any | `git --version` |

> **No Docker?** You can run PostgreSQL natively — see [1.4 Start the Database](#14-start-the-database) for the manual option.

---

## Part 1 — Backend Setup

### 1.1 Clone & Install

```bash
git clone https://github.com/your-username/LeetCommit.git
cd LeetCommit

# Install extension dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

---

### 1.2 Create a GitHub OAuth App

The extension uses GitHub OAuth to authenticate users and get write access to their GitHub repos.

1. Go to **GitHub → Settings → Developer settings → OAuth Apps**

   ```
   https://github.com/settings/developers
   ```

2. Click **"New OAuth App"**

3. Fill in the form:

   ```
   Application name:      LeetCommit
   Homepage URL:          http://localhost:3000
   Authorization callback URL:  http://localhost:3000/api/auth/github/callback
   ```

   > **Important:** The callback URL must exactly match. In production, replace `localhost:3000` with your server's domain.

4. Click **"Register application"**

5. On the next page, copy:
   - **Client ID** — shown immediately
   - **Client Secret** — click "Generate a new client secret", copy it now (it won't be shown again)

   ```
   GITHUB_CLIENT_ID=Iv1.abc123def456...
   GITHUB_CLIENT_SECRET=abc123def456abc123def456abc123def456abc1
   ```

---

### 1.3 Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in all values:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (matches docker-compose.yml defaults)
DATABASE_URL="postgresql://leetcommit:leetpassword@localhost:5432/leetcommit_db?schema=public"

# JWT — generate a secure secret:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=paste_your_generated_secret_here
JWT_EXPIRES_IN=7d

# GitHub OAuth (from Step 1.2)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here

# Extension redirect URI — leave blank for local dev (shows HTML success page)
# In production: set this to your extension's identity.getRedirectURL() value
FRONTEND_EXTENSION_URL=
```

To generate a secure `JWT_SECRET` run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 1.4 Start the Database

**Option A — Docker (recommended):**

```bash
# From the project root
docker-compose up -d postgres
```

This starts PostgreSQL on port `5432` with:
- User: `leetcommit`
- Password: `leetpassword`
- Database: `leetcommit_db`

Verify it's running:

```bash
docker-compose ps
# postgres   Up   0.0.0.0:5432->5432/tcp
```

**Option B — Manual PostgreSQL:**

```bash
# Create database and user
psql -U postgres -c "CREATE USER leetcommit WITH PASSWORD 'leetpassword';"
psql -U postgres -c "CREATE DATABASE leetcommit_db OWNER leetcommit;"
```

Then update `DATABASE_URL` in `backend/.env` accordingly.

---

### 1.5 Run Database Migrations

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all tables: `users`, `problems`, `submissions`, `topics`, `problem_topics`, `snapshots`, `refresh_tokens`.

Verify the schema was applied:

```bash
npx prisma studio
# Opens a browser UI at http://localhost:5555 showing all tables
```

---

### 1.6 Start the Backend Server

```bash
cd backend
npm run dev
```

Expected output:

```
[INFO] Server running on http://localhost:3000
[INFO] Connected to database
```

Verify it works:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2025-06-17T..."}
```

---

## Part 2 — Extension Setup

### 2.1 Install Extension Dependencies

```bash
# From the project root
npm install
```

---

### 2.2 Build the Extension

```bash
npm run build
```

This runs three Vite builds in sequence and outputs to `dist/`:

```
dist/
├── manifest.json     (copied from root)
├── background.js     (IIFE — background service worker)
├── content.js        (IIFE — injected into leetcode.com)
├── popup.html        (popup entry)
├── popup.js          (React popup bundle)
├── popup.css         (Tailwind styles)
└── icons/            (extension icons)
```

---

### 2.3 Load into Firefox

**Step 1** — Open Firefox and navigate to:

```
about:debugging
```

**Step 2** — Click **"This Firefox"** in the left sidebar

```
┌─────────────────────────────────────────┐
│  about:debugging                        │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Setup        │  │  Temporary       │ │
│  │ This Firefox │◄ │  Extensions      │ │
│  │ ...          │  │                  │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

**Step 3** — Click **"Load Temporary Add-on..."**

**Step 4** — In the file picker, navigate to:

```
/home/kanak/LeetCommit/dist/
```

Select **`manifest.json`** and click **Open**.

**Step 5** — Confirm the extension appears:

```
┌─────────────────────────────────────────────┐
│  Temporary Extensions                        │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  LeetCommit              v1.0.1      │    │
│  │  Automatically detect accepted...   │    │
│  │                                     │    │
│  │  [Inspect]  [Reload]  [Remove]      │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

The LeetCommit icon will now appear in your Firefox toolbar.

> **Tip for development:** Use `npm run dev` instead of `npm run build` — it builds and automatically launches Firefox with the extension pre-loaded and keeps it hot-reloading.

---

## Part 3 — First-Time Login

**Step 1** — Click the **LeetCommit icon** in the Firefox toolbar to open the popup dashboard.

**Step 2** — Navigate to the **Status tab** (the `⚡` activity icon at the bottom of the sidebar).

**Step 3** — Click **"Force Sync"**.

```
┌─────────────────────────────────────────┐
│  System Status                          │
│  Extension and Backend Connectivity     │
│                               [Force Sync ↺] │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Engine      │  │  GitHub      │    │
│  │  ● Idle      │  │  ✗ Disconn.  │    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

**Step 4** — A GitHub authorization popup will open in Firefox. Sign in to GitHub and click **"Authorize LeetCommit"**.

**Step 5** — The popup closes and your Status tab updates:

```
┌─────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Engine      │  │  GitHub      │    │
│  │  ● Idle      │  │  ✓ Connected │    │
│  │              │  │  @your-name  │    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

You're now authenticated. The extension automatically refreshes tokens in the background — you won't need to log in again unless you explicitly disconnect.

---

## Part 4 — Using the Extension

### Solving a Problem

1. Go to **leetcode.com** and open any problem, e.g.:
   ```
   https://leetcode.com/problems/two-sum/
   ```

2. Write your solution in the editor and click **Submit**.

3. When LeetCode shows **"Accepted"**, the extension automatically:

   ```
   LeetCode shows "Accepted"
          │
          ▼  (XHR interceptor fires)
   Extension captures:
     - Problem title, difficulty, tags (from DOM)
     - Language, runtime, memory (from API response)
     - Submission ID (from URL)
          │
          ▼  (background worker)
   POST /api/submissions  →  backend saves to DB
          │
          ▼  (fire-and-forget)
   GitHub API  →  commits solution to:
     LeetCode-Solutions/Array/Two-Sum.py
   ```

4. Your GitHub `LeetCode-Solutions` repo (created automatically on first submission) will have a new commit:

   ```
   Sync LeetCode: Two Sum (python3)
   ```

   With file content:
   ```python
   # Problem: Two Sum
   # Difficulty: Easy
   # Tags: Array, Hash Table
   # Link: https://leetcode.com/problems/two-sum/

   class Solution:
       def twoSum(self, nums, target):
           ...
   ```

---

### The Dashboard

Click the LeetCommit icon anytime to open the popup. It auto-syncs your latest LeetCode stats when opened.

#### Overview Tab (🏠)

```
┌─────────────────────────────────────────┐
│  Dashboard                              │
│  Your real-time local LeetCode progress │
│                                         │
│  ┌──────────────────┐ ┌──────────────┐ │
│  │ Total Solved     │ │ Current      │ │
│  │ Locally          │ │ Streak       │ │
│  │                  │ │              │ │
│  │       247        │ │    12 🔥     │ │
│  └──────────────────┘ └──────────────┘ │
└─────────────────────────────────────────┘
```

Shows total problems solved (pulled directly from LeetCode) and your current daily streak.

#### Topics Tab (📚)

```
┌─────────────────────────────────────────┐
│  Topic Analysis                         │
│  Strengths and weaknesses detection     │
│                                         │
│  Top Practiced Topics                   │
│  Array          ████████████  89        │
│  Dynamic Prog.  ██████████    67        │
│  Hash Table     ████████      54        │
│  Tree           ██████        41        │
│  Graph          ████          28        │
│                                         │
│  ⚠ Identified Weaknesses               │
│  ┌─────────────────────────────────┐   │
│  │ Segment Tree    [High Priority] │   │
│  │ Very low volume. Focus here.    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

#### Analytics Tab (📈)

```
┌─────────────────────────────────────────┐
│  Growth Trends                          │
│                                         │
│  Daily Submissions (Tracked)            │
│   5 ┤    ╭─╮                            │
│   4 ┤  ╭─╯ ╰╮   ╭╮                    │
│   3 ┤╭─╯    ╰───╯╰──                  │
│   2 ┤│                                 │
│   1 ┤│                                 │
│     └─────────────────────────────     │
│      Jun 1   Jun 8   Jun 15  Jun 17    │
│                                         │
│  Difficulty Distribution               │
│        ┌────────────────┐              │
│    Easy│████████  54%   │              │
│  Medium│██████    33%   │              │
│    Hard│███       13%   │              │
│        └────────────────┘              │
└─────────────────────────────────────────┘
```

#### Tips Tab (💡)

```
┌─────────────────────────────────────────┐
│  AI Recommendations                     │
│  Personalized action plan               │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ⚡ Restore Your Streak           │  │
│  │ You haven't solved a problem     │  │
│  │ recently. Solve one Easy problem │  │
│  │ right now to keep momentum!      │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 📈 Step Out of Your Comfort Zone │  │
│  │ Over 60% of your solves are Easy.│  │
│  │ Tackle some Mediums for interview│  │
│  │ readiness.                       │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### Status Tab (⚡)

```
┌─────────────────────────────────────────┐
│  System Status              [Force Sync]│
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Engine      │  │  GitHub      │    │
│  │  ● Idle      │  │  ✓ Connected │    │
│  │  Last: 2m ago│  │  @kanak-01   │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Tracked     │  │  Last Sync   │    │
│  │  Records     │  │  Event       │    │
│  │  247 Subs.   │  │  two-sum     │    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

Click **Force Sync** at any time to manually pull your latest LeetCode stats.

---

## Development Workflow

### Hot-reload development (extension + Firefox):

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Extension (auto-launches Firefox)
npm run dev
```

`npm run dev` uses `web-ext run` which:
- Builds the extension
- Launches a Firefox instance with the extension pre-loaded
- Watches for file changes and auto-reloads

### Useful development commands:

```bash
# Type check the extension
npm run typecheck

# Lint (zero warnings enforced)
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format with Prettier
npm run format

# Validate the extension with Mozilla's linter
npm run ext:lint

# Clean build output
npm run clean

# Production build
npm run build
```

### Backend development commands:

```bash
cd backend

# Start with hot-reload
npm run dev

# Open Prisma Studio (DB browser UI)
npx prisma studio

# Apply schema changes to DB
npx prisma migrate dev --name your_change_name

# Regenerate Prisma client after schema changes
npx prisma generate

# Build for production
npm run build

# Run production build
npm start
```

### Inspecting the extension in Firefox:

1. Go to `about:debugging`
2. Click **"This Firefox"** → find LeetCommit → click **"Inspect"**
3. This opens the background service worker DevTools — check the **Console** for logs like:
   ```
   [LeetCommit][Background] Background script loaded.
   [LeetCommit][Detector] Installing submission detector...
   [LeetCommit][Submitter] Submission successfully sent to backend.
   ```

---

## API Reference

### Authentication

All endpoints except `/health` and `/api/auth/*` require a `Bearer` token.

```
Authorization: Bearer <accessToken>
```

### Endpoints

#### `POST /api/submissions`

Receives a detected accepted submission from the extension.

**Request body:**
```json
{
  "problem": {
    "titleSlug": "two-sum",
    "title": "Two Sum",
    "questionId": "1",
    "difficulty": "Easy",
    "tags": ["Array", "Hash Table"]
  },
  "submission": {
    "submissionId": "1234567890",
    "language": "python3",
    "runtime": "40 ms",
    "memory": "16.5 MB",
    "timestamp": 1717600000000,
    "code": "class Solution:\n    def twoSum(..."
  },
  "capturedAt": "2025-06-17T12:00:00.000Z"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "submissionId": "1234567890", ... }
}
```

**Response `200`** (duplicate — already exists):
```json
{
  "success": true,
  "data": { ... },
  "message": "Already exists"
}
```

---

#### `GET /api/submissions?page=1&limit=50`

Returns paginated list of your saved submissions.

**Response `200`:**
```json
{
  "success": true,
  "data": [ { "id": "...", "submissionId": "...", "language": "python3", ... } ],
  "meta": { "total": 247, "page": 1, "limit": 50, "totalPages": 5 }
}
```

---

#### `POST /api/snapshots`

Saves a full LeetCode profile snapshot (called automatically by the scheduler every 24h).

---

#### `GET /api/analytics/dashboard`

Returns aggregated analytics for the dashboard.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalSolved": 247,
    "difficultyDistribution": [...],
    "topicDistribution": {...},
    "weeklyGrowth": 12,
    "monthlyGrowth": 38,
    "dailyActivity": [...],
    "currentStreak": 12,
    "weakestTopics": [...],
    "recommendations": [...]
  }
}
```

---

#### `GET /api/auth/github`

Initiates GitHub OAuth flow. Called automatically by the extension.

#### `GET /api/auth/github/callback`

GitHub redirects here after user authorizes. Returns tokens to the extension.

#### `POST /api/auth/refresh`

Refreshes an expired access token.

**Request body:**
```json
{ "token": "your-refresh-token" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "accessToken": "new-jwt-token" }
}
```

---

## Scripts Reference

### Extension (root directory)

| Script | Description |
|---|---|
| `npm run build` | Production build → `dist/` |
| `npm run dev` | Build + launch Firefox with extension |
| `npm run dev:build` | Build only (no Firefox launch) |
| `npm run typecheck` | TypeScript strict type check |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Prettier format all source files |
| `npm run format:check` | Check formatting without changing files |
| `npm run ext:lint` | Mozilla web-ext linter |
| `npm run clean` | Remove `dist/` directory |

### Backend (`backend/` directory)

| Script | Description |
|---|---|
| `npm run dev` | Start with tsx hot-reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npx prisma migrate dev` | Create + apply a new migration |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma studio` | Open database browser UI |

---

## Troubleshooting

### Extension loads but nothing happens when I submit

**Check 1** — Open `about:debugging` → LeetCommit → **Inspect** → Console tab. You should see:
```
[LeetCommit][Background] Background script loaded.
[LeetCommit][Scheduler] Initializing background scheduler
[LeetCommit][Content] Content script loaded on https://leetcode.com/problems/two-sum/
[LeetCommit][Detector] Installing submission detector...
```
If the content script log is missing, the extension isn't injecting into the page. Try reloading the LeetCode tab.

**Check 2** — Make sure you're on a `leetcode.com/problems/*` URL (not the problem list, not a contest).

**Check 3** — After clicking Submit and seeing "Accepted", check the console for:
```
[LeetCommit][Detector] ✅ Accepted submission detected!
[LeetCommit][Submitter] Sending submission to http://localhost:3000/api/submissions
```
If the detector fires but the submitter fails, check that your backend is running.

---

### "GitHub Link: Disconnected" in Status tab

1. Click **"Force Sync"** in the Status tab
2. A GitHub OAuth popup should appear — complete the login
3. If no popup appears, check `about:debugging` → LeetCommit → Inspect → Console for errors
4. Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correctly set in `backend/.env`

---

### Backend returns 401 on submissions

The extension's access token may have expired. The extension refreshes it automatically — if it keeps failing:
1. Click **"Force Sync"** to trigger a fresh login
2. Check the backend console for JWT errors
3. Ensure `JWT_SECRET` in `backend/.env` hasn't changed (changing it invalidates all tokens)

---

### After restarting Firefox the extension is gone

Temporary add-ons (loaded via `about:debugging`) are removed on browser restart. You have two options:

**Option A** — Reload it every time:
```
about:debugging → This Firefox → Load Temporary Add-on → dist/manifest.json
```

**Option B** — Use the dev command (auto-reloads a dedicated Firefox instance):
```bash
npm run dev
```

**Option C** — Sign and install permanently (requires a Mozilla developer account):
```bash
npm run ext:lint   # must pass first
web-ext sign --api-key=... --api-secret=...
```

---

### PostgreSQL connection error on backend start

1. Verify Docker is running:
   ```bash
   docker-compose ps
   ```
2. Verify the connection string in `backend/.env` matches your setup:
   ```
   DATABASE_URL="postgresql://leetcommit:leetpassword@localhost:5432/leetcommit_db?schema=public"
   ```
3. Test the connection manually:
   ```bash
   psql "postgresql://leetcommit:leetpassword@localhost:5432/leetcommit_db"
   ```

---

### Solutions not appearing in GitHub repo

1. Check the backend logs for `Background GitHub sync failed`
2. Verify your GitHub token has `repo` scope (granted during OAuth)
3. Check if the `LeetCode-Solutions` repo was created on your GitHub account
4. Note: code is only pushed if the extension captures the solution code from the DOM — the code capture is best-effort since Monaco editor uses virtualization

---

## Tech Stack

### Extension

| Technology | Purpose |
|---|---|
| TypeScript 5 | Type safety across all modules |
| Vite 6 | Multi-entry build (content/background/popup as separate bundles) |
| React 19 | Popup dashboard UI |
| React Router 7 | Client-side routing in popup |
| Tailwind CSS 3 | Utility-first styling |
| Recharts 3 | Activity, difficulty, and topic charts |
| TanStack Query 5 | Data fetching and caching in popup |
| web-ext | Development server + Mozilla linter |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + TypeScript | Runtime + type safety |
| Express 4 | HTTP server and routing |
| Prisma 6 | ORM + migrations for PostgreSQL |
| PostgreSQL 15 | Relational database |
| Zod | Runtime schema validation for all inputs |
| jsonwebtoken | JWT access tokens |
| bcrypt | Password hashing (for email/password auth) |
| @octokit/rest | GitHub API — creating repos and committing files |
| axios | HTTP client for GitHub OAuth exchange |
| Helmet | Security headers |
| Pino | Structured JSON logging |
| Docker | Containerised database and backend |

---

## License

MIT — see [LICENSE](LICENSE) for details.
