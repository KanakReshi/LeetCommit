import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AnalyticsService } from '../services/analytics.service';
import { WeaknessService } from '../services/weakness.service';
import { RecommendationService } from '../services/recommendation.service';
import { logger } from '../utils/logger';

export const getDashboardAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Run heavily computational analytics aggregations concurrently
    const [analytics, weakestTopics, recommendations] = await Promise.all([
      AnalyticsService.getDashboardAnalytics(userId),
      WeaknessService.getWeakestTopics(userId),
      RecommendationService.getRecommendations(userId)
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        weakestTopics,
        recommendations
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get dashboard analytics');
    next(error);
  }
};
