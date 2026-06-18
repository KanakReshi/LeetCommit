import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analytics.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/dashboard', requireAuth, getDashboardAnalytics);

export default router;
