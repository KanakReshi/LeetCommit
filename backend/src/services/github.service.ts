import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';
import { getExtensionForLanguage, getCommentPrefix } from '../utils/languageMap';

const log = logger;

export class GithubService {
  private octokit: Octokit;
  private defaultRepoName = 'LeetCode-Solutions';
  private owner: string;

  constructor(githubToken: string, owner: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.owner = owner;
  }

  /**
   * Orchestrates the push to GitHub.
   * 1. Ensures repo exists
   * 2. Constructs path based on category, question ID and title
   * 3. Commits the README and solution file
   */
  async pushSolution(params: {
    problemTitle: string;
    problemSlug: string;
    questionId?: string;
    difficulty: string;
    tags: string[];
    language: string;
    code: string;
    runtime?: string;
    memory?: string;
    runtimePercentile?: number;
    memoryPercentile?: number;
    categoryTitle?: string;
    descriptionHtml?: string;
  }): Promise<void> {
    try {
      await this.ensureRepositoryExists();

      const {
        problemTitle,
        problemSlug,
        questionId,
        difficulty,
        tags,
        language,
        code,
        runtime,
        memory,
        runtimePercentile,
        memoryPercentile,
        categoryTitle,
        descriptionHtml,
      } = params;
      const extension = getExtensionForLanguage(language);

      const folder = this.getProblemFolder(questionId, problemSlug, categoryTitle);
      // Solution filename uses the slug (already kebab-case)
      const solutionFilename = `${problemSlug}${extension}`;
      const filePath = `${folder}/${solutionFilename}`;
      const message = this.getSolutionCommitMessage(runtime, memory, runtimePercentile, memoryPercentile);

      const commentPrefix = getCommentPrefix(language);
      const template = `${commentPrefix} Problem: ${problemTitle}\n${commentPrefix} Difficulty: ${difficulty}\n${commentPrefix} Tags: ${tags.join(', ') || 'None'}\n${commentPrefix} Link: https://leetcode.com/problems/${problemSlug}/\n\n${code}`;

      await this.ensureProblemReadme(folder, problemTitle, problemSlug, difficulty, descriptionHtml);
      await this.commitFile(filePath, message, template);
      log.info(`Successfully pushed solution to ${this.owner}/${this.defaultRepoName}/${filePath}`);
    } catch (error) {
      log.error({ err: error }, `Failed to push solution to GitHub:`);
      throw error;
    }
  }

  /**
   * Checks if the default repository exists, and creates it if it doesn't.
   */
  private async ensureRepositoryExists(): Promise<void> {
    try {
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.defaultRepoName,
      });
      // Repo exists
    } catch (error: any) {
      if (error.status === 404) {
        log.info(`Repository ${this.defaultRepoName} not found. Creating it...`);
        try {
          await this.octokit.repos.createForAuthenticatedUser({
            name: this.defaultRepoName,
            description: 'Collection of LeetCode solutions automatically synced via LeetCommit.',
            private: false,
            auto_init: true, // Initialize with README
          });
          log.info(`Created repository: ${this.defaultRepoName}`);
        } catch (createError) {
          log.error({ err: createError }, 'Error creating repository:');
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Commits the given content to the target file path.
   * Fetches the file's SHA if it exists so we can overwrite it.
   */
  private async commitFile(path: string, message: string, content: string): Promise<void> {
    let sha: string | undefined;

    // 1. Try to get the existing file to extract its SHA (needed for updates)
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.defaultRepoName,
        path,
      });

      // getContent can return an array if path is a directory. We expect a file.
      if (!Array.isArray(response.data) && response.data.type === 'file') {
        sha = response.data.sha;
      }
    } catch (error: any) {
      // 404 is expected if the file doesn't exist yet
      if (error.status !== 404) {
        log.warn(`Error checking existing file at ${path}:`, error.message);
      }
    }

    // 2. Create or update the file
    // Content must be base64 encoded
    const contentBase64 = Buffer.from(content).toString('base64');

    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.defaultRepoName,
      path,
      message,
      content: contentBase64,
      sha, // Undefined if it's a new file, populated if it's an update
    });
  }

  private async ensureProblemReadme(
    folder: string,
    problemTitle: string,
    problemSlug: string,
    difficulty: string,
    descriptionHtml?: string
  ): Promise<void> {
    const readmePath = `${folder}/README.md`;

    if (await this.fileExists(readmePath)) {
      return;
    }

    const badgeColor = this.getDifficultyBadgeColor(difficulty);
    const badgeUrl = `https://img.shields.io/badge/Difficulty-${difficulty}-${badgeColor}`;

    // Build the README with the full LeetCode HTML description
    let readme: string;
    if (descriptionHtml) {
      readme =
        `<h2><a href="https://leetcode.com/problems/${problemSlug}">${problemTitle}</a></h2> ` +
        `<img src='${badgeUrl}' alt='Difficulty: ${difficulty}' /><hr>` +
        descriptionHtml;
    } else {
      // Fallback when description wasn't captured
      readme =
        `<h2><a href="https://leetcode.com/problems/${problemSlug}">${problemTitle}</a></h2> ` +
        `<img src='${badgeUrl}' alt='Difficulty: ${difficulty}' /><hr>` +
        `<p>Visit <a href="https://leetcode.com/problems/${problemSlug}">LeetCode</a> to view the full problem description.</p>`;
    }

    await this.commitFile(readmePath, `docs: add README for ${problemTitle}`, readme);
  }

  /** Maps LeetCode difficulty to a shields.io colour name */
  private getDifficultyBadgeColor(difficulty: string): string {
    switch (difficulty.toLowerCase()) {
      case 'easy':   return 'brightgreen';
      case 'medium': return 'orange';
      case 'hard':   return 'red';
      default:       return 'lightgrey';
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.defaultRepoName,
        path,
      });

      return !Array.isArray(response.data) && response.data.type === 'file';
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Builds the folder path: <Category>/<questionId>-<problemSlug>
   * e.g. Database/1757-recyclable-and-low-fat-products
   *      Algorithms/1143-longest-common-subsequence
   */
  private getProblemFolder(
    questionId: string | undefined,
    problemSlug: string,
    categoryTitle?: string
  ): string {
    const category = (categoryTitle?.trim() || 'Algorithms').replace(/\s+/g, '-');
    const normalizedId = questionId?.trim();

    if (normalizedId && normalizedId !== 'unknown') {
      return `${category}/${normalizedId}-${problemSlug}`;
    }

    return `${category}/${problemSlug}`;
  }

  /**
   * Commit message format:
   * Time: <runtime>ms (<runtimePercentile>%) | Memory: <memory> (<memoryPercentile>%) - LeetCommit
   */
  private getSolutionCommitMessage(
    runtime?: string,
    memory?: string,
    runtimePercentile?: number,
    memoryPercentile?: number
  ): string {
    const rt = runtime ? runtime.replace(/ms$/, '').trim() : 'N/A';
    const rtPct = runtimePercentile != null ? `${runtimePercentile.toFixed(2)}%` : 'N/A';
    const mem = memory ?? 'N/A';
    const memPct = memoryPercentile != null ? `${memoryPercentile.toFixed(2)}%` : 'N/A';
    return `Time: ${rt}ms (${rtPct}) | Memory: ${mem} (${memPct}) - LeetCommit`;
  }
}
