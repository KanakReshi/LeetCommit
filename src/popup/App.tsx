import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import TopicsPage from './pages/TopicsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RecommendationsPage from './pages/RecommendationsPage';
import SyncStatusPage from './pages/SyncStatusPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (typeof browser === 'undefined') {
      setIsLoggedIn(true);
      return;
    }
    browser.storage.local.get('github').then((result) => {
      const github = result.github as { token?: string } | undefined;
      setIsLoggedIn(!!github?.token);
    });

    // React live when the background finishes OAuth and writes the config.
    const onChanged = (changes: Record<string, any>, area: string) => {
      if (area !== 'local' || !('github' in changes)) return;
      setIsLoggedIn(!!changes.github.newValue?.token);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  React.useEffect(() => {
    // Auto-sync automatically when the extension popup opens
    if (typeof browser === 'undefined') return;
    
    (async () => {
      try {
        const userRes = await fetch('https://leetcode.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ userStatus { username isSignedIn } }' })
        });
        const userData = await userRes.json();
        if (!userData.data.userStatus.isSignedIn) return;
        
        const username = userData.data.userStatus.username;
        const profileQuery = `
          query userProfile($username: String!) {
            matchedUser(username: $username) {
              submissionCalendar
              submitStats { acSubmissionNum { difficulty count } }
              tagProblemCounts {
                advanced { tagName problemsSolved }
                intermediate { tagName problemsSolved }
                fundamental { tagName problemsSolved }
              }
            }
            recentAcSubmissionList(username: $username, limit: 100) { titleSlug timestamp }
          }
        `;
        
        const profileRes = await fetch('https://leetcode.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: profileQuery, variables: { username } })
        });
        const profileData = await profileRes.json();
        const matchedUser = profileData.data.matchedUser;
        const recentList = profileData.data.recentAcSubmissionList || [];
        
        const calendar = JSON.parse(matchedUser.submissionCalendar);
        interface RecentSub { titleSlug: string; timestamp: string }
        interface TagCount { tagName: string; problemsSolved: number }
        interface DiffCount { difficulty: string; count: number }

        const newSubmissions: { problemSlug: string; timestamp: number; status: string }[] = [];

        (recentList as RecentSub[]).forEach((s) => {
          newSubmissions.push({ problemSlug: s.titleSlug, timestamp: parseInt(s.timestamp) * 1000, status: 'SYNCED' });
        });
        Object.keys(calendar).forEach(ts => {
          const count = calendar[ts] as number;
          for (let i = 0; i < count; i++) newSubmissions.push({ problemSlug: `historical-${ts}-${i}`, timestamp: parseInt(ts) * 1000, status: 'SYNCED' });
        });

        const tagCounts = matchedUser.tagProblemCounts as { advanced: TagCount[]; intermediate: TagCount[]; fundamental: TagCount[] };
        const topicsObj: Record<string, number> = {};
        [...(tagCounts.advanced || []), ...(tagCounts.intermediate || []), ...(tagCounts.fundamental || [])].forEach((t) => {
           topicsObj[t.tagName] = t.problemsSolved;
        });

        const diffObj: Record<string, number> = {};
        (matchedUser.submitStats.acSubmissionNum as DiffCount[]).forEach((d) => {
          if (d.difficulty !== 'All') diffObj[d.difficulty] = d.count;
        });

        await browser.storage.local.set({ 
          submissions: newSubmissions,
          exactTopics: topicsObj,
          exactDifficulties: diffObj,
          syncStatus: { isSyncing: false, lastSyncAt: Date.now(), lastError: null }
        });
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    })();
  }, []);

  if (isLoggedIn === null) {
    return <div className="flex h-screen bg-slate-950" />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <MemoryRouter>
      <DashboardLayout onLogout={() => setIsLoggedIn(false)}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/sync" element={<SyncStatusPage />} />
        </Routes>
      </DashboardLayout>
    </MemoryRouter>
  );
}
