import React, { useEffect, useState } from 'react';
import { RefreshCw, Code2, CheckCircle, XCircle, Clock, Database, Check, Wifi } from 'lucide-react';

interface ExtensionStorage {
  syncStatus: {
    isSyncing: boolean;
    lastSyncAt: number | null;
    lastError: string | null;
  };
  token: {
    githubUsername: string | null;
  };
  submissions: Array<{
    problemSlug: string;
    timestamp: number;
    status: string;
  }>;
}

export default function SyncStatusPage() {
  const [data, setData] = useState<ExtensionStorage | null>(null);
  const [connStatus, setConnStatus] = useState<string | null>(null);
  const [connTesting, setConnTesting] = useState(false);

  useEffect(() => {
    // Attempt to load live data from Firefox extension storage
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(['syncStatus', 'token', 'submissions']).then((res) => {
        setData({
          syncStatus: res.syncStatus || { isSyncing: false, lastSyncAt: null, lastError: null },
          token: res.token || { githubUsername: null },
          submissions: res.submissions || []
        });
      });
    } else {
      // Fallback mock data for local browser dev (vite serve)
      setData({
        syncStatus: { isSyncing: false, lastSyncAt: Date.now() - 3600000, lastError: null },
        token: { githubUsername: 'kanak-01' },
        submissions: []
      });
    }
  }, []);

  if (!data) {
    return <div className="animate-pulse text-slate-400 p-6">Loading status...</div>;
  }

  const { syncStatus, token, submissions } = data;
  const lastSyncDate = syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never';
  const totalSubmissions = submissions?.length || 0;
  const lastProblem = submissions?.[0]?.problemSlug || 'None';

  return (
    <div className="space-y-6 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Status</h1>
          <p className="text-slate-400 text-sm mt-1">Extension and Backend Connectivity</p>
        </div>
        <button 
          onClick={async () => {
            if (typeof browser === 'undefined') return;
            try {
              setData(prev => prev ? { ...prev, syncStatus: { ...prev.syncStatus, isSyncing: true } } : null);
              
              // 1. Get username
              const userRes = await fetch('https://leetcode.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: '{ userStatus { username isSignedIn } }' })
              });
              const userData = await userRes.json();
              if (!userData.data.userStatus.isSignedIn) {
                throw new Error("Not logged into LeetCode on this browser.");
              }
              const username = userData.data.userStatus.username;

              // 2. Get full profile and skill stats
              const profileQuery = `
                query userProfile($username: String!) {
                  matchedUser(username: $username) {
                    submissionCalendar
                    submitStats {
                      acSubmissionNum { difficulty count }
                    }
                    tagProblemCounts {
                      advanced { tagName problemsSolved }
                      intermediate { tagName problemsSolved }
                      fundamental { tagName problemsSolved }
                    }
                  }
                  recentAcSubmissionList(username: $username, limit: 100) {
                    titleSlug timestamp
                  }
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
              
              // Parse submission calendar to generate fake submissions for the activity chart
              const calendar = JSON.parse(matchedUser.submissionCalendar);
              interface RecentSub { titleSlug: string; timestamp: string }
              interface TagCount { tagName: string; problemsSolved: number }
              interface DiffCount { difficulty: string; count: number }

              const newSubmissions: { problemSlug: string; timestamp: number; status: string }[] = [];

              // Add real recent submissions with actual slugs
              (recentList as RecentSub[]).forEach((s) => {
                newSubmissions.push({
                  problemSlug: s.titleSlug,
                  timestamp: parseInt(s.timestamp) * 1000,
                  status: 'SYNCED'
                });
              });

              // Pad with calendar data for historical dates (streak tracking)
              Object.keys(calendar).forEach(ts => {
                const count = calendar[ts] as number;
                const tsNum = parseInt(ts) * 1000;
                for (let i = 0; i < count; i++) {
                   newSubmissions.push({
                     problemSlug: `historical-${ts}-${i}`,
                     timestamp: tsNum,
                     status: 'SYNCED'
                   });
                }
              });

              // Extract topics directly from LeetCode
              const tagCounts = matchedUser.tagProblemCounts as { advanced: TagCount[]; intermediate: TagCount[]; fundamental: TagCount[] };
              const topicsObj: Record<string, number> = {};
              [...(tagCounts.advanced || []), ...(tagCounts.intermediate || []), ...(tagCounts.fundamental || [])].forEach((t) => {
                 topicsObj[t.tagName] = t.problemsSolved;
              });

              // Extract difficulties directly
              const diffCounts = (matchedUser.submitStats.acSubmissionNum as DiffCount[]);
              const diffObj: Record<string, number> = {};
              diffCounts.forEach((d) => {
                if (d.difficulty !== 'All') {
                  diffObj[d.difficulty] = d.count;
                }
              });

              // Save to storage
              await browser.storage.local.set({ 
                submissions: newSubmissions,
                exactTopics: topicsObj,
                exactDifficulties: diffObj
              });
              
              setData(prev => prev ? { 
                ...prev, 
                submissions: newSubmissions,
                syncStatus: { isSyncing: false, lastSyncAt: Date.now(), lastError: null } 
              } : null);
              
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setData(prev => prev ? { ...prev, syncStatus: { ...prev.syncStatus, isSyncing: false, lastError: message } } : null);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-indigo-500/20"
        >
          <RefreshCw className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
          Force Sync
        </button>
      </header>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Sync Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${syncStatus.isSyncing ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <RefreshCw className={`w-5 h-5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Engine Status</div>
              <div className="text-slate-200 font-semibold">{syncStatus.isSyncing ? 'Syncing Now...' : 'Idle (Ready)'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3" />
            <span>Last Sync: {lastSyncDate}</span>
          </div>
        </div>

        {/* GitHub Connection Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${token.githubUsername ? 'bg-indigo-500/20 text-indigo-400' : 'bg-red-500/20 text-red-400'}`}>
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">GitHub Link</div>
              <div className="text-slate-200 font-semibold">{token.githubUsername ? 'Connected' : 'Disconnected'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            {token.githubUsername ? (
               <><Check className="w-3 h-3 text-emerald-400" /><span>Logged in as {token.githubUsername}</span></>
            ) : (
               <><XCircle className="w-3 h-3 text-red-400" /><span>Please authenticate</span></>
            )}
          </div>
        </div>
        
        {/* Total Tracked Submissions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-cyan-500/20 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Tracked Records</div>
              <div className="text-slate-200 font-semibold">{totalSubmissions} Submissions</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Successfully stored locally</span>
          </div>
        </div>

        {/* Last Synced Problem */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-fuchsia-500/20 text-fuchsia-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Last Sync Event</div>
              <div className="text-slate-200 font-semibold truncate w-32" title={lastProblem}>{lastProblem}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3" />
            <span>Pushed to repository</span>
          </div>
        </div>
      </div>
      
      {syncStatus.lastError && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <h3 className="text-red-400 text-sm font-semibold">Sync Error Detected</h3>
            <p className="text-red-300/70 text-xs mt-1">{syncStatus.lastError}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={async () => {
            setConnTesting(true);
            setConnStatus(null);
            try {
              const resp = await browser.runtime.sendMessage({ type: 'TEST_CONNECTION' });
              setConnStatus(resp.type === 'OK' ? `✅ ${resp.message}` : `❌ ${resp.message}`);
            } catch (err) {
              setConnStatus(`❌ ${err instanceof Error ? err.message : String(err)}`);
            } finally {
              setConnTesting(false);
            }
          }}
          disabled={connTesting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Wifi className={`w-4 h-4 ${connTesting ? 'animate-pulse' : ''}`} />
          {connTesting ? 'Testing…' : 'Test Backend Connection'}
        </button>
        {connStatus && (
          <p className="text-xs text-slate-300 px-1">{connStatus}</p>
        )}
      </div>
    </div>
  );
}
