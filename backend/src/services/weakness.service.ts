import { prisma } from '../utils/prisma';

interface TopicStats {
  tagName: string;
  tagSlug: string;
  problemsSolved: number;
}

export class WeaknessService {
  /**
   * Identifies the user's weakest algorithmic topics.
   * Uses a composite scoring algorithm based on:
   * 1. Relative Volume: How few problems solved compared to their strongest topic.
   * 2. Recency Decay: How long since they last solved a problem in this topic.
   * 3. Struggle Rate: Ratio of failed attempts to total attempts for the topic.
   */
  static async getWeakestTopics(userId: string, limit: number = 5) {
    // 1. Get Base Volume from Snapshot
    const latestSnapshot = await prisma.snapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    let allTopics: TopicStats[] = [];

    if (latestSnapshot) {
      const data = latestSnapshot.data as any;
      const distributions = data?.topicDistributions || {};
      
      // Combine fundamental, intermediate, and advanced topics
      allTopics = [
        ...(distributions.fundamental || []),
        ...(distributions.intermediate || []),
        ...(distributions.advanced || []),
      ];
    }

    if (allTopics.length === 0) {
      return []; // Not enough data
    }

    const maxSolved = Math.max(...allTopics.map(t => t.problemsSolved), 1);

    // 2. Get Recency and Struggle Metrics from Submissions Table
    // We use a raw query to join submissions with problem topics and calculate aggregates.
    const submissionStats = await prisma.$queryRaw`
      SELECT 
        t.slug as "tagSlug",
        MAX(s.timestamp) as "lastSolvedDate",
        COUNT(s.id)::int as "totalAttempts",
        SUM(CASE WHEN s.status = 'Accepted' THEN 1 ELSE 0 END)::int as "acceptedAttempts"
      FROM submissions s
      JOIN problems p ON s."problemId" = p.id
      JOIN problem_topics pt ON p.id = pt."problemId"
      JOIN topics t ON pt."topicId" = t.id
      WHERE s."userId" = ${userId}
      GROUP BY t.slug;
    ` as Array<{
      tagSlug: string;
      lastSolvedDate: Date;
      totalAttempts: number;
      acceptedAttempts: number;
    }>;

    // Create a fast lookup map
    const statsMap = new Map(submissionStats.map(s => [s.tagSlug, s]));

    // 3. Composite Scoring Algorithm
    const scoredTopics = allTopics.map(topic => {
      const stats = statsMap.get(topic.tagSlug);
      
      // Metric 1: Volume Weakness (0 to 1) - 1 means they haven't solved much
      const volumeWeakness = 1 - (topic.problemsSolved / maxSolved);

      // Metric 2: Recency Decay (0 to 1) - 1 means they haven't touched it in 60+ days
      let recencyWeakness = 1; // Default to worst if no submission found in our DB
      if (stats && stats.lastSolvedDate) {
        const daysSinceLastSolved = (Date.now() - new Date(stats.lastSolvedDate).getTime()) / (1000 * 60 * 60 * 24);
        recencyWeakness = Math.min(1, daysSinceLastSolved / 60);
      }

      // Metric 3: Failure Rate (0 to 1) - 1 means every attempt was a fail
      let failureWeakness = 0.5; // Default to neutral if no data
      if (stats && stats.totalAttempts > 0) {
        const failedAttempts = stats.totalAttempts - stats.acceptedAttempts;
        failureWeakness = failedAttempts / stats.totalAttempts;
      }

      // Weighted Total Weakness Score (Scale 0-100)
      const WEIGHT_VOLUME = 0.40;
      const WEIGHT_RECENCY = 0.40;
      const WEIGHT_FAILURE = 0.20;

      const weaknessScore = (
        (volumeWeakness * WEIGHT_VOLUME) +
        (recencyWeakness * WEIGHT_RECENCY) +
        (failureWeakness * WEIGHT_FAILURE)
      ) * 100;

      return {
        tagName: topic.tagName,
        tagSlug: topic.tagSlug,
        problemsSolved: topic.problemsSolved,
        weaknessScore: Math.round(weaknessScore * 10) / 10, // Round to 1 decimal
        lastPracticed: stats?.lastSolvedDate || null,
        failureRate: Math.round(failureWeakness * 100)
      };
    });

    // 4. Sort by Weakness (Highest first) and filter out completely untouched topics
    // (We only want to rank weaknesses among topics they are actually trying or have some exposure to)
    const rankedWeaknesses = scoredTopics
      .filter(t => t.problemsSolved > 0) // Remove topics with 0 solves (they aren't weak, just unstarted)
      .sort((a, b) => b.weaknessScore - a.weaknessScore)
      .slice(0, limit);

    return rankedWeaknesses;
  }
}
