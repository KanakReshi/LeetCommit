import { PrismaClient } from '@prisma/client';
import { GithubService } from '../src/services/github.service';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function migrateUserRepositories() {
  logger.info('Starting repository migration for all users...');

  const users = await prisma.user.findMany({
    where: {
      githubToken: { not: null },
      githubUsername: { not: null },
    },
  });

  if (users.length === 0) {
    logger.info('No users with GitHub integration found. Exiting.');
    return;
  }

  for (const user of users) {
    logger.info(`Migrating repository for user: ${user.githubUsername}`);
    const githubService = new GithubService(user.githubToken!, user.githubUsername!);

    // Get all submissions for the user
    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      include: { 
        problem: {
          include: {
            problemTopics: {
              include: { topic: true }
            }
          }
        } 
      },
    });

    if (submissions.length === 0) {
      logger.info(`  No submissions found for user ${user.githubUsername}. Skipping.`);
      continue;
    }

    let successCount = 0;
    let failCount = 0;

    for (const sub of submissions) {
      try {
        const tags = sub.problem.problemTopics.map((pt) => pt.topic.name);
        await githubService.pushSolution({
          problemTitle: sub.problem.title,
          problemSlug: sub.problem.titleSlug,
          difficulty: sub.problem.difficulty,
          tags: tags,
          language: sub.language,
          code: sub.code,
        });
        successCount++;
        // Adding a small delay to avoid hitting GitHub API secondary rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        logger.error({ err: error.message }, `  Failed to migrate problem: ${sub.problem.title}`);
        failCount++;
      }
    }

    logger.info(`Completed migration for ${user.githubUsername}: ${successCount} successful, ${failCount} failed.`);
    
    // Note: To be completely safe, we do not programmatically delete the 'Easy', 'Medium', 'Hard' folders here.
    // The user can manually delete them from their GitHub repository once they verify the new folders are correct.
  }

  logger.info('Global migration complete.');
  await prisma.$disconnect();
}

migrateUserRepositories().catch((error) => {
  logger.error({ err: error }, 'Fatal error during migration');
  process.exit(1);
});
