import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, AlertTriangle, Zap, LucideIcon } from 'lucide-react';

export default function RecommendationsPage() {
  const [advice, setAdvice] = useState<{title: string; desc: string; icon: LucideIcon; color: string}[]>([]);

  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(['submissions', 'exactDifficulties', 'exactTopics']).then((res) => {
        const newAdvice = [];
        const submissions = res.submissions || [];
        
        // 1. Streak Advice
        let isStreakActive = false;
        if (submissions.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          const latest = new Date(submissions[0].timestamp).toISOString().split('T')[0];
          isStreakActive = (latest === today || latest === yesterday);
        }
        
        if (!isStreakActive) {
          newAdvice.push({
            title: 'Restore Your Streak',
            desc: "You haven't solved a problem recently. Solve one 'Easy' problem right now just to keep your momentum going!",
            icon: Zap,
            color: 'text-orange-400 bg-orange-400/20'
          });
        }

        // 2. Difficulty Balance Advice
        if (res.exactDifficulties) {
          const easy = res.exactDifficulties['Easy'] || 0;
          const medium = res.exactDifficulties['Medium'] || 0;
          const hard = res.exactDifficulties['Hard'] || 0;
          const total = easy + medium + hard;
          
          if (total > 10) {
            if (easy / total > 0.6) {
              newAdvice.push({
                title: 'Step Out of Your Comfort Zone',
                desc: `Over 60% of your solves are Easy. It's time to tackle some Mediums to build interview readiness.`,
                icon: TrendingUp,
                color: 'text-emerald-400 bg-emerald-400/20'
              });
            } else if (hard === 0 && medium > 10) {
              newAdvice.push({
                title: 'Attempt a Hard Problem',
                desc: 'You have a solid foundation in Mediums but 0 Hard problems. Try a well-known Hard problem today.',
                icon: Target,
                color: 'text-rose-400 bg-rose-400/20'
              });
            }
          }
        }

        // 3. Topic Weakness Advice
        if (res.exactTopics) {
          const topics = Object.entries(res.exactTopics as Record<string, number>)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => a.count - b.count);
            
          const weakest = topics.filter(t => t.count > 0 && t.count < 5);
          if (weakest.length > 0) {
             newAdvice.push({
               title: `Focus on ${weakest[0].topic}`,
               desc: `You have very few solves in ${weakest[0].topic}. Prioritize this topic for your next 3 practice sessions.`,
               icon: AlertTriangle,
               color: 'text-blue-400 bg-blue-400/20'
             });
          }
        }

        if (newAdvice.length === 0) {
          newAdvice.push({
            title: 'Keep Up the Great Work!',
            desc: 'Your stats are perfectly balanced. Try doing a mock interview or a virtual contest next!',
            icon: Target,
            color: 'text-indigo-400 bg-indigo-400/20'
          });
        }

        setAdvice(newAdvice);
      });
    }
  }, []);

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">AI Recommendations</h1>
        <p className="text-slate-400 text-sm mt-1">Personalized action plan based on your stats</p>
      </header>
      <div className="space-y-4">
        {advice.length > 0 ? advice.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-sm">{item.title}</h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        }) : (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
            Calculating advice...
          </div>
        )}
      </div>
    </div>
  );
}
