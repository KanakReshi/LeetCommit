# LeetCommit

> Automatically detect accepted LeetCode submissions, sync your progress to a personal dashboard, and push every solution directly to your GitHub — all from a Firefox extension. **No backend required!**

---

## Table of Contents

- [Features](#-features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Extension Setup](#extension-setup)
- [First-Time Setup](#first-time-setup)
- [Using the Extension](#using-the-extension)
  - [Dashboard Features](#dashboard-features)
- [Development Workflow](#development-workflow)
- [Scripts Reference](#scripts-reference)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## What It Does

LeetCommit is a Firefox extension that makes your LeetCode grind visible and actionable.

```
You solve a problem on LeetCode
        │
        ▼
Extension detects "Accepted" (via XHR intercept)
        │
        ├──► Extracts Description & Metadata via LeetCode GraphQL
        │
        └──► Solution code and README.md pushed directly to GitHub repo
                  (LeetCode-Solutions/Algorithms/1-Two-Sum/Two-Sum.py)
```

---

## 🎯 Features

### **Core Submission Features**

- **🔄 Direct GitHub Sync** — Automatically push accepted solutions to your GitHub repository with **zero backend required**
- **🎯 Auto-detection** — Intercepts LeetCode's XHR API endpoints to detect "Accepted" submissions instantly (no manual triggers)
- **📁 Structured Organization** — Automatically creates neat folder hierarchies: `<topic>/<question-id>-<title-kebab-case>/`
- **📝 Rich README Generation** — Auto-generates `README.md` for each problem including:
  - Problem description (extracted from LeetCode HTML)
  - Difficulty badges with shields.io styling
  - Time & Space complexity metrics
  - Links back to LeetCode problem page
- **⚡ Performance Metrics in Commits** — Commit messages include runtime & memory percentiles:
  ```
  Time: 40ms (90%) | Memory: 16MB (80%) - LeetCommit
  ```
- **🛡️ Smart Duplicate Prevention** — Skips pushing if code exactly matches latest GitHub version (prevents redundant commits)

### **Dashboard & Analytics (Local-First)**

- **📊 Overview Tab** — Total problems solved + current daily/weekly streak
- **📚 Topics Tab** — Categorized problem breakdown by topic with strength/weakness detection
- **📈 Analytics Tab** — Growth trends with interactive charts (difficulty distribution, daily activity)
- **💡 Recommendations Tab** — AI-style personalized action plan based on weak areas
- **⚡ Status Tab** — System configuration, sync history, and GitHub token management
- **📱 Offline-First Design** — All data stored locally in browser; no external analytics

### **Resilience & Background Processing**

- **🔁 Retry Queue System** — Failed GitHub syncs automatically queue with exponential backoff
- **⏰ Scheduled Sync** — 24-hour background stats sync with LeetCode (streak, solved count)
- **🔐 Secure Token Storage** — GitHub tokens stored in browser.storage.local with typed encryption helpers
- **🌐 Zero Backend Required** — All processing happens in-browser; direct GitHub API integration

---

## ✨ Why LeetCommit?

| Challenge                           | Solution                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- |
| **Losing progress**                 | All solutions automatically sync to GitHub + backed up with rich metadata |
| **Forgetting what you solved**      | Dashboard shows streak, solved count, topic breakdown, and growth trends  |
| **Weak areas unclear**              | Analytics identify strengths/weaknesses and recommend focus areas         |
| **Manual GitHub commits tedious**   | One-click setup; everything after is automatic (no backend, no database)  |
| **Performance metrics not tracked** | Commit messages include runtime/memory percentiles automatically          |
| **Dashboard data privacy**          | All data stays local in your browser; no cloud storage required           |

---

## 🏗️ Architecture Overview

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
│  │  submitter.ts            │  fetch to GitHub API      │
│  │  → retry queue           │ ─────────────────────────┼──►
│  │  → token configuration   │                           │
│  │                          │                           │
│  │  scheduler.ts            │  Queries LeetCode GraphQL │
│  │  → 24h stats sync        │ ─────────────────────────┼──►
│  └──────────────────────────┘                           │
│                                                          │
│  ┌──────────────────────────┐                           │
│  │     Popup Dashboard      │                           │
│  │   (React + Tailwind)     │                           │
│  │                          │                           │
│  │  Overview  │  Topics     │                           │
│  │  Analytics │  Status     │                           │
│  └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
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
│
├── src/                       # Extension source code
│   │
│   ├── types/                 # TypeScript interfaces (Submission, Problem, Stats, etc.)
│   │
│   ├── constants/             # Global constants and configuration
│   │
│   ├── utils/
│   │   ├── github.ts          # GitHub API integration (Octokit wrapper)
│   │   ├── storage.ts         # Typed browser.storage.local helpers
│   │   ├── logger.ts          # Namespaced console logger
│   │   ├── api.ts             # Core API for GitHub sync
│   │   └── markdown.ts        # README.md generation logic
│   │
│   ├── services/
│   │   ├── StorageService.ts  # Token + settings CRUD operations
│   │   └── LeetCodeGraphQLService.ts  # LeetCode GraphQL queries (stats, problem details)
│   │
│   ├── content/               # Injected into leetcode.com pages
│   │   ├── detector.ts        # XHR intercept - detects "Accepted" submissions
│   │   ├── extractor.ts       # Scrapes problem title, difficulty, tags
│   │   └── index.ts           # Content script entry
│   │
│   ├── background/            # Service worker (runs in background)
│   │   ├── handler.ts         # Message router (content ↔ background)
│   │   ├── submitter.ts       # GitHub sync + retry queue logic
│   │   ├── scheduler.ts       # 24h stats sync scheduler
│   │   ├── auth.ts            # Token validation & refresh
│   │   └── index.ts           # Background worker entry
│   │
│   └── popup/                 # Extension popup UI (React)
│       ├── App.tsx            # Main routing container
│       ├── main.tsx           # React entry point
│       ├── popup.html         # HTML template
│       ├── popup.css          # Popup styles (Tailwind)
│       │
│       ├── pages/             # Dashboard pages (all tabs)
│       │   ├── OverviewPage.tsx      # Problems solved + streak
│       │   ├── TopicsPage.tsx        # Topic breakdown & analysis
│       │   ├── AnalyticsPage.tsx     # Charts & trends (Recharts)
│       │   ├── RecommendationsPage.tsx  # AI recommendations
│       │   ├── SyncStatusPage.tsx    # Config & queue monitor
│       │   └── LoginPage.tsx         # GitHub auth flow
│       │
│       └── components/        # Reusable UI components
│           ├── ChartCard.tsx  # Recharts wrapper
│           ├── StatCard.tsx   # Metric display
│           ├── TopicList.tsx  # Topic list renderer
│           └── ...
```

### Feature Implementation Breakdown

| Feature                 | Responsible Module       | Key Files                                                    |
| ----------------------- | ------------------------ | ------------------------------------------------------------ |
| **Auto-detection**      | Content script           | `content/detector.ts`                                        |
| **Metadata extraction** | Content script + GraphQL | `content/extractor.ts`, `services/LeetCodeGraphQLService.ts` |
| **GitHub sync**         | Background worker        | `background/submitter.ts`, `utils/github.ts`                 |
| **README generation**   | Utility layer            | `utils/markdown.ts`                                          |
| **Retry queue**         | Background worker        | `background/submitter.ts`                                    |
| **Stats & streak**      | Background scheduler     | `background/scheduler.ts`                                    |
| **Dashboard UI**        | React popup              | `popup/pages/*`                                              |
| **Charts & analytics**  | Recharts integration     | `popup/components/ChartCard.tsx`                             |
| **Local storage**       | Service layer            | `services/StorageService.ts`                                 |
| **Token management**    | Auth + Storage           | `background/auth.ts`, `services/StorageService.ts`           |

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool    | Version    | Check            |
| ------- | ---------- | ---------------- |
| Node.js | ≥ 18.0.0   | `node --version` |
| npm     | ≥ 9.0.0    | `npm --version`  |
| Firefox | any recent | —                |

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-username/LeetCommit.git
cd LeetCommit
npm install

# 2. Build the extension
npm run build

# 3. Load in Firefox
# Open about:debugging → "This Firefox" → "Load Temporary Add-on..." → select dist/manifest.json

# 4. Configure GitHub Token
# Click LeetCommit → Status Tab → Enter GitHub credentials

# 5. Start solving on LeetCode!
# Your first accepted solution will auto-sync to GitHub
```

---

## Extension Setup

### 1. Clone & Install

```bash
git clone https://github.com/your-username/LeetCommit.git
cd LeetCommit
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This runs Vite builds in sequence and outputs to `dist/`.

### 3. Load into Firefox

**Step 1** — Open Firefox and navigate to: `about:debugging`

**Step 2** — Click **"This Firefox"** in the left sidebar

**Step 3** — Click **"Load Temporary Add-on..."**

**Step 4** — In the file picker, navigate to `dist/` inside the LeetCommit directory.

**Step 5** — Select **`manifest.json`** and click **Open**.

The LeetCommit icon will now appear in your Firefox toolbar.

---

## First-Time Setup

Since the extension syncs directly to GitHub via the browser, you just need a GitHub Personal Access Token.

**Step 1** — Create a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer Settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**.
3. Give it a name and select the `repo` scope (Full control of private repositories).
4. Copy the generated token.

**Step 2** — Configure the Extension

1. Click the **LeetCommit icon** in the Firefox toolbar.
2. Go to the **Status tab** (the `⚡` activity icon).
3. Enter your **GitHub Username**, **Personal Access Token**, and the **Repository Name** (e.g., `LeetCode-Solutions`). _(Note: You must create this repository manually on GitHub first)._
4. Click **Save Configuration**.

---

## Using the Extension

### Solving a Problem

1. Go to **leetcode.com** and submit a solution to any problem.
2. When LeetCode shows **"Accepted"**, the extension automatically detects the submission.
3. The extension extracts the problem metadata and description via the LeetCode GraphQL API.
4. It creates a structured folder in your repository, e.g., `Algorithms/1-Two-Sum/`.
5. It pushes two files to your GitHub:
   - `Two-Sum.py` (your code)
   - `README.md` (Rich problem description and shields.io badges)
6. The commit message includes performance metrics automatically:
   `Time: 40 ms (90.5%) | Memory: 16 MB (80.1%) - LeetCommit`

---

### Dashboard Features

Click the LeetCommit icon anytime to open the popup dashboard.

#### 🏠 **Overview Tab**

- Total problems solved (synced from LeetCode)
- Current daily streak counter
- Weekly/monthly progress indicators
- Quick GitHub sync status indicator

#### 📚 **Topics Tab**

- Problems organized by difficulty and category
- Strength analysis (topics you excel at)
- Weakness detection (areas needing practice)
- Suggested focus areas based on solve history
- Topic-wise solve rate percentages

#### 📈 **Analytics Tab**

- **Growth Trends Chart** — Track problems solved over time
- **Difficulty Distribution** — Visual breakdown of Easy/Medium/Hard problems
- **Daily Activity Heatmap** — See your most productive days
- **Solve Rate Statistics** — Success rate by difficulty level
- **Time Series Data** — All stored locally in browser

#### 💡 **Recommendations Tab**

- **Personalized Action Plan** — Suggested next problems based on weak topics
- **Learning Patterns** — Identifies optimal learning sequences
- **Smart Suggestions** — "You solved 80% of Easy problems, try Medium next"
- **Performance Insights** — Tracks improvement trends per category

#### ⚡ **Status Tab**

- **Configuration Panel** — GitHub username, repository name, token management
- **Sync History** — Shows last sync time, success/failure status
- **Queue Monitor** — View pending uploads and retry attempts
- **Local Records Count** — Total cached problems locally
- **System Status** — Extension health, background worker status

---

## Development Workflow

### Hot-reload development:

```bash
npm run dev
```

`npm run dev` uses `web-ext run` which:

- Builds the extension
- Launches a Firefox instance with the extension pre-loaded
- Watches for file changes and auto-reloads

### Inspecting the extension in Firefox:

1. Go to `about:debugging`
2. Click **"This Firefox"** → find LeetCommit → click **"Inspect"**
3. Check the **Console** for background service worker logs.

---

## Scripts Reference

| Script              | Description                           |
| ------------------- | ------------------------------------- |
| `npm run build`     | Production build → `dist/`            |
| `npm run dev`       | Build + launch Firefox with extension |
| `npm run dev:build` | Build only (no Firefox launch)        |
| `npm run typecheck` | TypeScript strict type check          |
| `npm run lint`      | ESLint (zero warnings enforced)       |
| `npm run lint:fix`  | Auto-fix ESLint issues                |
| `npm run format`    | Prettier format all source files      |
| `npm run ext:lint`  | Mozilla web-ext linter                |
| `npm run clean`     | Remove `dist/` directory              |

---

## Troubleshooting

### Extension loads but nothing happens when I submit

**Check 1** — Open `about:debugging` → LeetCommit → **Inspect** → Console tab. You should see:

```
[LeetCommit][Background] Background script loaded.
[LeetCommit][Content] Content script loaded
```

**Check 2** — Make sure you're on a `leetcode.com/problems/*` URL (not the problems list page).

**Check 3** — After submitting a solution, check the console for:

```
✅ Accepted submission detected!
📡 Extracting problem metadata...
✅ Problem extracted successfully
🔄 Syncing to GitHub...
✅ GitHub sync complete
```

### Solutions not appearing in GitHub repo

1. **Verify token permissions** — Open `about:debugging` → Background Service Worker console
2. **Look for errors** — Search console for `GITHUB API SYNC ERROR` or `401 Unauthorized`
3. **Check token scope** — Ensure your Personal Access Token has the `repo` scope (full control)
4. **Verify repo exists** — The extension does NOT auto-create repositories; you must create it manually
5. **Check folder structure** — Solutions sync to `<topic>/<problem-id>-<title>/` by default

### Dashboard not showing any data

- **First sync pending** — Solve your first problem on LeetCode to populate the dashboard
- **Local storage cleared** — If you cleared browser data, stats will reset (sync to GitHub is unaffected)
- **LeetCode login session expired** — Re-login to LeetCode and wait 24h for stats refresh

### Retry queue stuck or sync constantly failing

1. Open the **Status Tab** → view **Sync History**
2. Check your **GitHub token expiration** (if using personal access tokens with expiry)
3. Open Background Worker console → look for specific API error messages
4. **Force retry** — Disable and re-enable the extension in `about:addons`

### "Failed to fetch from LeetCode" error

- **Rate limited** — LeetCode throttles GraphQL queries after 50+ requests/hour
- **Wait 1-2 hours** or solve problems more gradually
- Check if LeetCode changed their GraphQL schema (rare, but notify maintainers if you see this)

---

## Tech Stack

| Technology             | Version | Purpose               | Features                                                              |
| ---------------------- | ------- | --------------------- | --------------------------------------------------------------------- |
| **TypeScript**         | 5.8     | Type-safe development | Strict mode across all modules; prevents runtime errors               |
| **Vite**               | 6.3     | Build tooling         | Multi-entry builds (content, background, popup as separate bundles)   |
| **React**              | 19      | UI framework          | Dashboard popup with responsive tabs and smooth interactions          |
| **React Router**       | 7       | Client-side routing   | Tab navigation (Overview, Topics, Analytics, Recommendations, Status) |
| **Tailwind CSS**       | 3.4     | Styling               | Utility-first design for consistent, responsive UI                    |
| **Recharts**           | 3.8     | Charts & graphs       | Growth trends, difficulty distribution, daily activity heatmaps       |
| **TanStack Query**     | 5.101   | Data fetching         | Smart caching, background sync, and auto-retry for stats              |
| **Fetch API**          | Native  | HTTP requests         | GitHub API calls (commits, file uploads), LeetCode GraphQL queries    |
| **Web Extensions API** | MV3     | Extension platform    | Content scripts, background workers, messaging, persistent storage    |
| **web-ext**            | 10.4    | Dev tooling           | Firefox loading, hot-reload, and Mozilla Add-ons linting              |

### Architecture Benefits

- **🚀 Zero Backend** — All logic runs in-browser using Web Extensions API
- **⚡ Real-time** — Content scripts detect submissions instantly via XHR interception
- **🔒 Secure** — GitHub tokens stored locally; no external analytics
- **📱 Responsive** — React + Tailwind ensures dashboard works on all desktop sizes
- **🎯 Type-Safe** — TypeScript strict mode prevents silent failures
- **🔄 Modular** — Separate bundles for content, background, and popup reduce extension size

---

## License

MIT — see [LICENSE](LICENSE) for details.
