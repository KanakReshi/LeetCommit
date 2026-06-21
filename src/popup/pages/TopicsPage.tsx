import { useEffect, useState } from 'react';
import TopicChart from '../components/charts/TopicChart';
import { AlertCircle } from 'lucide-react';
import browser from 'webextension-polyfill';

export default function TopicsPage() {
  const [topicData, setTopicData] = useState<{topic: string; count: number}[]>([]);
  const [weaknesses, setWeaknesses] = useState<{topic: string; msg: string; priority: string}[]>([]);

  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(['submissions', 'exactTopics']).then((res) => {
        const topicMap: Record<string, number> = (res.exactTopics as Record<string, number>) || {};
        
        // Fallback to computing from submissions if exactTopics doesn't exist
        if (!res.exactTopics) {
          const submissions = (res.submissions || []) as { tags?: string[] }[];
          submissions.forEach((sub) => {
            if (sub.tags && Array.isArray(sub.tags)) {
              sub.tags.forEach((tag: string) => {
                topicMap[tag] = (topicMap[tag] || 0) + 1;
              });
            }
          });
        }

        const sorted = Object.keys(topicMap)
          .map(k => ({ topic: k, count: topicMap[k] }))
          .sort((a, b) => b.count - a.count);
        
        setTopicData(sorted.slice(0, 5)); // top 5
        
        // Calculate weaknesses based on the lowest count topics that have at least 1 attempt
        const bottomTopics = sorted.slice(-3).reverse().filter(t => t.count > 0 && t.count < 10);
        
        const generatedWeaknesses = bottomTopics.map((t, i) => {
          if (i === 0) {
            return { topic: t.topic, priority: 'High Priority', msg: 'Very low volume of successful submissions. Focus here next.' };
          }
          return { topic: t.topic, priority: 'Medium Priority', msg: 'Needs more practice to build muscle memory.' };
        });

        if (generatedWeaknesses.length === 0 && sorted.length > 0) {
          generatedWeaknesses.push({ topic: 'Advanced Graphs', priority: 'Medium Priority', msg: 'Consider tackling harder problems to stretch your skills.' });
        }
        
        setWeaknesses(generatedWeaknesses);
      });
    }
  }, []);

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Topic Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Strengths and weaknesses detection</p>
      </header>
      
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Practiced Topics</h2>
          <TopicChart data={topicData} />
        </div>

        <div className="bg-slate-900/50 border border-red-900/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-100">Identified Weaknesses</h2>
          </div>
          <div className="space-y-3">
            {weaknesses.length > 0 ? weaknesses.map((w, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex justify-between items-center">
                  <span className="text-slate-200 font-medium text-sm">{w.topic}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    w.priority === 'High Priority' ? 'text-red-400 bg-red-400/10' : 'text-orange-400 bg-orange-400/10'
                  }`}>
                    {w.priority}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">{w.msg}</p>
              </div>
            )) : (
              <div className="text-slate-500 text-sm italic">Not enough data to identify weaknesses.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
