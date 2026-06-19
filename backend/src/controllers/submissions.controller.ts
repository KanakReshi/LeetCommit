import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';

export const saveSubmission = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const payload = req.body; // Evaluated against Zod schema in middleware
    console.log(`[Submission] Received from user ${userId}: ${payload?.problem?.title ?? 'unknown'} (${payload?.submission?.language ?? '?'})`);

    // The extension sends payload.problem and payload.submission
    const { problem, submission, capturedAt } = payload;

    // Check if submission already exists (idempotency)
    const existing = await prisma.submission.findUnique({
      where: { submissionId: submission.submissionId },
    });

    if (existing) {
      logInfo(userId, `Duplicate submission ignored: ${submission.submissionId}`);
      res.status(200).json({ success: true, data: existing, message: 'Already exists' });
      return;
    }

    const newSubmission = await prisma.submission.create({
      data: {
        user: { connect: { id: userId } },
        submissionId: submission.submissionId,
        language: submission.language,
        code: submission.code || '',
        runtime: submission.runtime,
        memory: submission.memory,
        timestamp: new Date(capturedAt || Date.now()),
        problem: {
          connectOrCreate: {
            where: { titleSlug: problem.titleSlug },
            create: {
              titleSlug: problem.titleSlug,
              title: problem.title,
              difficulty: problem.difficulty || 'Unknown',
              problemTopics: {
                create: (problem.tags || []).map((tag: string) => ({
                  topic: {
                    connectOrCreate: {
                      where: { slug: tag.toLowerCase().replace(/\s+/g, '-') },
                      create: {
                        name: tag,
                        slug: tag.toLowerCase().replace(/\s+/g, '-'),
                      },
                    },
                  },
                })),
              },
            },
          },
        },
      },
    });

    // Fire-and-forget GitHub sync if user has OAuth enabled
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log(`[GitHub Sync] user found: ${!!user}, githubToken: ${!!user?.githubToken}, githubUsername: ${user?.githubUsername ?? 'none'}`);
    if (user && user.githubToken && user.githubUsername) {
      console.log(`[GitHub Sync] Starting sync for ${user.githubUsername} — ${problem.title}`);
      import('../services/github.service').then(({ GithubService }) => {
        const githubService = new GithubService(user.githubToken!, user.githubUsername!);
        githubService.pushSolution({
          problemTitle: problem.title,
          problemSlug: problem.titleSlug,
          questionId: problem.questionId,
          difficulty: problem.difficulty || 'Unknown',
          tags: problem.tags || [],
          language: submission.language,
          code: submission.code || '',
          runtime: submission.runtime,
          memory: submission.memory,
        }).then(() => {
          console.log(`[GitHub Sync] ✅ Pushed to ${user.githubUsername}/LeetCode`);
        }).catch((err) => {
          console.error(`[GitHub Sync] ❌ Failed: ${err.message}`);
          logger.error({ userId, err: err.message }, 'Background GitHub sync failed');
        });
      });
    } else {
      console.log(`[GitHub Sync] Skipped — user has no GitHub token. They need to log in via GitHub OAuth.`);
    }

    logInfo(userId, `Saved new submission: ${submission.submissionId}`);
    res.status(201).json({ success: true, data: newSubmission });
  } catch (error) {
    next(error);
  }
};

export const listSubmissions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    
    // Simple pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const submissions = await prisma.submission.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.submission.count({ where: { userId } });

    res.status(200).json({
      success: true,
      data: submissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

function logInfo(userId: string, msg: string) {
  logger.info({ userId }, msg);
}
