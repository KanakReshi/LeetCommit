import React, { useEffect, useState } from 'react';

export default function OverviewPage() {
  const [totalSolved, setTotalSolved] = useState<number | string>('--');
  const [currentStreak, setCurrentStreak] = useState<number | string>('--');

  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(['submissions', 'exactDifficulties']).then((res) => {
        
        // Accurate total solved
        if (res.exactDifficulties) {
           const e = res.exactDifficulties['Easy'] || 0;
           const m = res.exactDifficulties['Medium'] || 0;
           const h = res.exactDifficulties['Hard'] || 0;
           setTotalSolved(e + m + h);
        } else {
           const submissions = res.submissions || [];
           // Fallback to counting unique slugs
           const uniqueSlugs = new Set((submissions as { problemSlug: string }[]).map((s) => s.problemSlug));
           setTotalSolved(uniqueSlugs.size);
        }

        const submissions = res.submissions || [];
        if (submissions.length === 0) {
          setCurrentStreak(0);
          return;
        }

        // Calculate simple streak based on unique dates
        const dates = (submissions as { timestamp: number }[]).map((sub) => new Date(sub.timestamp).toISOString().split('T')[0]);
        const uniqueDates = Array.from(new Set(dates)).sort().reverse(); // e.g. ["2023-10-07", "2023-10-06"]
        
        let streak = 0;
        let today = new Date().toISOString().split('T')[0];
        let yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Basic streak logic
        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          streak = 1;
          for (let i = 0; i < uniqueDates.length - 1; i++) {
            const current = new Date(uniqueDates[i]);
            const next = new Date(uniqueDates[i+1]);
            const diffDays = Math.round((current.getTime() - next.getTime()) / 86400000);
            if (diffDays === 1) {
              streak++;
            } else {
              break;
            }
          }
        }
        
        setCurrentStreak(streak);
      });
    }
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Your real-time local LeetCode progress.</p>
      </header>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-sm font-medium">Total Solved Locally</div>
          <div className="text-3xl font-bold text-white mt-1">{totalSolved}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-sm font-medium">Current Streak</div>
          <div className="text-3xl font-bold text-orange-400 mt-1">{currentStreak} 🔥</div>
        </div>
      </div>
    </div>
  );
}
