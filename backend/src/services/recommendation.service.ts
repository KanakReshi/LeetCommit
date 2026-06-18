import { prisma } from '../utils/prisma';
import { WeaknessService } from './weakness.service';
import { AnalyticsService } from './analytics.service';

interface Recommendation {
  type: 'URGENT' | 'IMPROVEMENT' | 'EXPLORATION' | 'MASTERY';
  title: string;
  description: string;
  actionTopic: string | null;
  priority: number; // 1 is highest
}

export class RecommendationService {
  /**
   * Generates actionable recommendations based on the user's progress, strengths, and weaknesses.
   */
  static async getRecommendations(userId: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // 1. Fetch all required context concurrently
    const [latestSnapshot, weakestTopics, activityData] = await Promise.all([
      prisma.snapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      WeaknessService.getWeakestTopics(userId, 3),
      AnalyticsService.getActivityAndStreak(userId)
    ]);

    // Parse Snapshot for Topics
    let allTopics: any[] = [];
    if (latestSnapshot) {
      const data = latestSnapshot.data as any;
      const distributions = data?.topicDistributions || {};
      allTopics = [
        ...(distributions.fundamental || []),
        ...(distributions.intermediate || []),
        ...(distributions.advanced || []),
      ];
    }

    // --- 1. URGENT: Streak Maintenance ---
    const today = new Date().toISOString().split('T')[0];
    const rawActivity = activityData.dailyActivity as any[];
    const solvedToday = rawActivity.some(row => new Date(row.date).toISOString().split('T')[0] === today);

    if (!solvedToday && activityData.currentStreak > 0) {
      recommendations.push({
        type: 'URGENT',
        title: 'Keep Your Streak Alive!',
        description: `You have a ${activityData.currentStreak}-day streak going. Solve any quick problem today to keep the momentum!`,
        actionTopic: null,
        priority: 1
      });
    }

    // --- 2. IMPROVEMENT: Weakness Targeting ---
    if (weakestTopics.length > 0) {
      const weakest = weakestTopics[0];
      
      let reason = 'it has been a while since you practiced it';
      if (weakest.failureRate > 50) reason = 'you have been struggling with accuracy';

      recommendations.push({
        type: 'IMPROVEMENT',
        title: `Strengthen your ${weakest.tagName} skills`,
        description: `Your ${weakest.tagName} score is decaying because ${reason}. Try a targeted practice session.`,
        actionTopic: weakest.tagName,
        priority: 2
      });
    }

    // --- 3. EXPLORATION: Untouched Topics ---
    if (allTopics.length > 0) {
      const untouched = allTopics.filter(t => t.problemsSolved === 0);
      if (untouched.length > 0) {
        // Pick a random untouched topic to suggest
        const randomUntouched = untouched[Math.floor(Math.random() * untouched.length)];
        recommendations.push({
          type: 'EXPLORATION',
          title: `Discover ${randomUntouched.tagName}`,
          description: `You haven't solved any problems related to ${randomUntouched.tagName}. Try solving one Easy problem to grasp the basics.`,
          actionTopic: randomUntouched.tagName,
          priority: 3
        });
      }
    }

    // --- 4. MASTERY: Push Limits on Strongest Topic ---
    if (allTopics.length > 0) {
      const strongest = [...allTopics].sort((a, b) => b.problemsSolved - a.problemsSolved)[0];
      
      // Only suggest mastery if they actually have a good chunk solved
      if (strongest && strongest.problemsSolved > 10) {
        recommendations.push({
          type: 'MASTERY',
          title: `Master ${strongest.tagName}`,
          description: `You have solved ${strongest.problemsSolved} problems in ${strongest.tagName}. Challenge yourself by filtering for Hard difficulty ${strongest.tagName} problems!`,
          actionTopic: strongest.tagName,
          priority: 4
        });
      }
    }

    // Sort by priority before returning
    return recommendations.sort((a, b) => a.priority - b.priority);
  }
}
