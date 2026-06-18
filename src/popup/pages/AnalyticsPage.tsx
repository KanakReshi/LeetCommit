import React, { useEffect, useState } from 'react';
import ActivityChart from '../components/charts/ActivityChart';
import DifficultyChart from '../components/charts/DifficultyChart';

export default function AnalyticsPage() {
  const [activityData, setActivityData] = useState<{date: string; count: number}[]>([]);
  const [difficultyData, setDifficultyData] = useState<{difficulty: string; count: number}[]>([]);

  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(['submissions', 'exactDifficulties']).then((res) => {
        const submissions = res.submissions || [];
        
        // Aggregate Activity Data
        const activityMap: Record<string, number> = {};
        let diffMap: Record<string, number> = res.exactDifficulties || { 'Easy': 0, 'Medium': 0, 'Hard': 0 };

        (submissions as { timestamp: number; difficulty?: string }[]).forEach((sub) => {
          // Date formatting for activity
          const d = new Date(sub.timestamp).toISOString().split('T')[0];
          activityMap[d] = (activityMap[d] || 0) + 1;

          // Difficulty fallback if exactDifficulties not present
          if (!res.exactDifficulties) {
            const diff = sub.difficulty || 'Medium';
            if (diffMap[diff] !== undefined) {
              diffMap[diff]++;
            }
          }
        });

        // Convert maps to chart arrays
        setActivityData(Object.keys(activityMap).map(k => ({ date: k, count: activityMap[k] })));
        setDifficultyData(Object.keys(diffMap).filter(k => diffMap[k] > 0).map(k => ({ difficulty: k, count: diffMap[k] })));
      });
    }
  }, []);

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Growth Trends</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time local analytics and charts</p>
      </header>
      
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Submissions (Tracked)</h2>
          <ActivityChart data={activityData} />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Difficulty Distribution</h2>
          <DifficultyChart data={difficultyData} />
        </div>
      </div>
    </div>
  );
}
