import { createLogger } from '../utils/logger';

const log = createLogger('LeetCodeGraphQL');

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql/';

// --- GraphQL Queries ---

const QUERIES = {
  USER_PROFILE: `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        githubUrl
        twitterUrl
        linkedinUrl
        profile {
          realName
          userAvatar
          birthday
          ranking
          reputation
          websites
          countryName
          company
          school
          skillTags
          aboutMe
          starRating
        }
      }
    }
  `,
  SOLVED_COUNTS: `
    query userSessionProgress($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
          totalSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `,
  TOPIC_TAGS: `
    query skillStats($username: String!) {
      matchedUser(username: $username) {
        tagProblemCounts {
          advanced {
            tagName
            tagSlug
            problemsSolved
          }
          intermediate {
            tagName
            tagSlug
            problemsSolved
          }
          fundamental {
            tagName
            tagSlug
            problemsSolved
          }
        }
      }
    }
  `,
  RECENT_SUBMISSIONS: `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
        statusDisplay
        lang
      }
    }
  `,
  GET_CURRENT_USER: `
    query globalData {
      userStatus {
        username
      }
    }
  `,
};

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class LeetCodeGraphQLService {
  private static cache: Map<string, CacheEntry<unknown>> = new Map();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default
  private static MAX_RETRIES = 3;
  private static RETRY_DELAY_MS = 1000;

  // Rate limiting queue
  private static isRequesting = false;
  private static requestQueue: Array<() => void> = [];

  /**
   * Enqueues a network request to respect rate limits
   */
  private static async enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          // Delay next request slightly to prevent 429 Too Many Requests
          setTimeout(() => {
            if (this.requestQueue.length > 0) {
              const nextTask = this.requestQueue.shift();
              if (nextTask) nextTask();
            } else {
              this.isRequesting = false;
            }
          }, 500); // 500ms delay between GraphQL calls
        }
      });

      if (!this.isRequesting) {
        this.isRequesting = true;
        const nextTask = this.requestQueue.shift();
        if (nextTask) nextTask();
      }
    });
  }

  /**
   * Core GraphQL Fetcher with Retries
   */
  private static async fetchGraphQL<T>(
    query: string,
    variables: Record<string, unknown>,
    cacheKey: string
  ): Promise<T> {
    // 1. Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      log.debug(`Cache hit for ${cacheKey}`);
      return cached.data as T;
    }

    // 2. Execute Network Request with Retries
    return this.enqueueRequest(async () => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          log.debug(`Fetching ${cacheKey} (Attempt ${attempt}/${this.MAX_RETRIES})`);

          const response = await fetch(LEETCODE_GRAPHQL_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          });

          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();

          if (result.errors) {
            throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
          }

          // 3. Set Cache
          this.cache.set(cacheKey, {
            data: result.data,
            expiry: Date.now() + this.CACHE_TTL_MS,
          });

          return result.data as T;
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          log.warn(`Attempt ${attempt} failed for ${cacheKey}: ${lastError.message}`);

          if (attempt < this.MAX_RETRIES) {
            // Exponential backoff
            await new Promise((res) => setTimeout(res, this.RETRY_DELAY_MS * attempt));
          }
        }
      }

      log.error(`All ${this.MAX_RETRIES} attempts failed for ${cacheKey}`);
      throw lastError || new Error('GraphQL Request Failed');
    });
  }

  // --- Public API Methods ---

  /**
   * Fetches the user's public profile and ranking.
   */
  static async getUserProfile(username: string) {
    const data = await this.fetchGraphQL<unknown>(
      QUERIES.USER_PROFILE,
      { username },
      `profile_${username}`
    );
    return (data as { matchedUser: unknown }).matchedUser;
  }

  /**
   * Fetches the number of solved questions across difficulties.
   */
  static async getSolvedCounts(username: string) {
    const data = await this.fetchGraphQL<unknown>(
      QUERIES.SOLVED_COUNTS,
      { username },
      `solved_${username}`
    );
    const typedData = data as {
      allQuestionsCount: unknown;
      matchedUser?: { submitStats: unknown };
    };
    return {
      allQuestions: typedData.allQuestionsCount,
      submitStats: typedData.matchedUser?.submitStats,
    };
  }

  /**
   * Fetches the distribution of solved topics (e.g. Arrays, Hash Maps).
   */
  static async getTopicDistributions(username: string) {
    const data = await this.fetchGraphQL<unknown>(
      QUERIES.TOPIC_TAGS,
      { username },
      `topics_${username}`
    );
    return (data as { matchedUser?: { tagProblemCounts: unknown } }).matchedUser?.tagProblemCounts;
  }

  /**
   * Fetches the user's most recent accepted submissions.
   */
  static async getRecentSubmissions(username: string, limit: number = 15) {
    const data = await this.fetchGraphQL<unknown>(
      QUERIES.RECENT_SUBMISSIONS,
      { username, limit },
      `recent_subs_${username}_${limit}`
    );
    return (data as { recentAcSubmissionList: unknown }).recentAcSubmissionList;
  }

  /**
   * Fetches the currently logged-in LeetCode username.
   */
  static async getCurrentUsername(): Promise<string | null> {
    const data = await this.fetchGraphQL<unknown>(QUERIES.GET_CURRENT_USER, {}, 'current_user');
    const typedData = data as { userStatus?: { username: string } };
    return typedData.userStatus?.username || null;
  }

  /**
   * Aggregates all statistics for the Snapshot backend payload.
   */
  static async getFullProfileSnapshot(username: string) {
    // Execute all queries in parallel (rate limiter handles staggering internally)
    const [profile, solvedCounts, topicDistributions, recentSubmissions] = await Promise.all([
      this.getUserProfile(username),
      this.getSolvedCounts(username),
      this.getTopicDistributions(username),
      this.getRecentSubmissions(username, 5), // Just grab last 5 for snapshot overview
    ]);

    return {
      profile,
      solvedCounts,
      topicDistributions,
      recentSubmissions,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Clears the in-memory cache manually.
   */
  static clearCache() {
    this.cache.clear();
    log.info('GraphQL Cache cleared.');
  }
}
