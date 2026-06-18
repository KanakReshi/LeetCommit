import { prisma } from '../utils/prisma';

export class AnalyticsService {
  /**
   * Fetches the latest snapshot to return total solved and difficulty/topic distributions.
   */
  static async getOverviewMetrics(userId: string) {
    const latestSnapshot = await prisma.snapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestSnapshot) {
      return null;
    }

    const data = latestSnapshot.data as any;

    return {
      totalSolved: data?.solvedCounts?.allQuestions?.[0]?.count || 0,
      difficultyDistribution: data?.solvedCounts?.submitStats?.acSubmissionNum || [],
      topicDistribution: data?.topicDistributions || {},
      capturedAt: latestSnapshot.createdAt,
    };
  }

  /**
   * Calculates growth by comparing the latest snapshot to snapshots from exactly 7 and 30 days ago.
   */
  static async getGrowthMetrics(userId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [latest, weekOld, monthOld] = await Promise.all([
      prisma.snapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.snapshot.findFirst({ where: { userId, createdAt: { lte: sevenDaysAgo } }, orderBy: { createdAt: 'desc' } }),
      prisma.snapshot.findFirst({ where: { userId, createdAt: { lte: thirtyDaysAgo } }, orderBy: { createdAt: 'desc' } }),
    ]);

    const getCount = (snap: any) => (snap?.data as any)?.solvedCounts?.allQuestions?.[0]?.count || 0;

    const currentTotal = getCount(latest);
    const weeklyTotal = getCount(weekOld);
    const monthlyTotal = getCount(monthOld);

    return {
      weeklyGrowth: weekOld ? currentTotal - weeklyTotal : currentTotal,
      monthlyGrowth: monthOld ? currentTotal - monthlyTotal : currentTotal,
    };
  }

  /**
   * Calculates daily activity and the current continuous submission streak.
   * Uses raw SQL for efficient DATE grouping.
   */
  static async getActivityAndStreak(userId: string) {
    // 1. Get Daily Activity (Last 365 days)
    const dailyActivity = await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date, 
        COUNT(id)::int as count 
      FROM submissions 
      WHERE "userId" = ${userId} 
        AND status = 'Accepted'
        AND timestamp >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY DATE(timestamp) 
      ORDER BY DATE(timestamp) DESC;
    `;

    // 2. Calculate Current Streak
    // Uses window functions to find consecutive dates
    const streakQuery = await prisma.$queryRaw`
      WITH distinct_dates AS (
          SELECT DISTINCT DATE(timestamp) as active_date
          FROM submissions
          WHERE "userId" = ${userId} AND status = 'Accepted'
      ),
      streak_groups AS (
          SELECT 
              active_date,
              active_date - (ROW_NUMBER() OVER (ORDER BY active_date DESC))::int as grp
          FROM distinct_dates
      )
      SELECT COUNT(*)::int as current_streak
      FROM streak_groups
      WHERE grp = (
          SELECT grp 
          FROM streak_groups 
          WHERE active_date >= CURRENT_DATE - INTERVAL '1 day' 
          ORDER BY active_date DESC 
          LIMIT 1
      )
    `;

    const streakData = streakQuery as { current_streak: number }[];
    const streak = streakData.length > 0 ? streakData[0].current_streak : 0;

    return {
      dailyActivity,
      currentStreak: streak,
    };
  }

  /**
   * Aggregates everything into a single dashboard payload.
   */
  static async getDashboardAnalytics(userId: string) {
    const [overview, growth, activity] = await Promise.all([
      this.getOverviewMetrics(userId),
      this.getGrowthMetrics(userId),
      this.getActivityAndStreak(userId),
    ]);

    return {
      ...overview,
      ...growth,
      ...activity,
    };
  }
}
