import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import { saveSubmission, listSubmissions } from '../controllers/submissions.controller';

const router = Router();

// Payload structure matching the extension's SubmissionPayload
const submissionSchema = z.object({
  body: z.object({
    problem: z.object({
      titleSlug: z.string(),
      title: z.string(),
      questionId: z.string().optional(),
      difficulty: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    submission: z.object({
      submissionId: z.string(),
      language: z.string(),
      code: z.string().optional(),
      runtime: z.string().optional(),
      memory: z.string().optional(),
      timestamp: z.number().optional(),
    }),
    capturedAt: z.string().optional(),
  }),
});

router.use(requireAuth);

router.post('/', validate(submissionSchema), saveSubmission);
router.get('/', listSubmissions);

export default router;
