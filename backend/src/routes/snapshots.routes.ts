import { Router } from 'express';
import { saveSnapshot, listSnapshots } from '../controllers/snapshots.controller';
import { requireAuth } from '../middlewares/auth';
import { z } from 'zod';
import { validate } from '../middlewares/validate';

const router = Router();

// Validation schema for snapshot payload
// The data from LeetCode GraphQL is highly nested and flexible, so we accept a general object
// and ensure `capturedAt` is present.
const snapshotSchema = z.object({
  body: z.object({
    profile: z.record(z.any()).optional(),
    solvedCounts: z.record(z.any()).optional(),
    topicDistributions: z.record(z.any()).optional(),
    recentSubmissions: z.array(z.any()).optional(),
    capturedAt: z.string().datetime().optional(),
  }),
});

router.post(
  '/',
  requireAuth,
  validate(snapshotSchema),
  saveSnapshot
);

router.get('/', requireAuth, listSnapshots);

export default router;
