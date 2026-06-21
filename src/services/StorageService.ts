/**
 * Firefox Extension Local Storage Service.
 *
 * Provides a robust, type-safe CRUD interface over browser.storage.local.
 * Handles specific domains: processed submissions, sync status, user settings,
 * and backend tokens, with built-in error handling.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('StorageService');

// ── Types ────────────────────────────────────────────────────────────────

export interface UserSettings {
  autoSync: boolean;
  debugMode: boolean;
  notifications: boolean;
}

export interface BackendToken {
  apiUrl?: string;
  accessToken: string;
  repo?: string;
  refreshToken: string;
  githubUsername: string | null;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: number | null;
  failedCount: number;
  lastError: string | null;
}

export interface ProcessedSubmission {
  submissionId: string;
  problemSlug: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  timestamp: number;
  payload: unknown;
}

/** Complete schema representing all local storage keys */
export interface AppStorage {
  settings: UserSettings;
  token: BackendToken;
  syncStatus: SyncStatus;
  submissions: ProcessedSubmission[];
}

/** Default state for a fresh install */
export const DEFAULT_APP_STORAGE: AppStorage = {
  settings: {
    autoSync: true,
    debugMode: false,
    notifications: true,
  },
  token: {
    apiUrl: '',
    accessToken: '',
    refreshToken: '',
    githubUsername: null,
  },
  syncStatus: {
    isSyncing: false,
    lastSyncAt: null,
    failedCount: 0,
    lastError: null,
  },
  submissions: [],
};

// ── Storage Service ──────────────────────────────────────────────────────

export class StorageService {
  /**
   * Initializes the storage with default values if they don't exist.
   */
  static async initialize(): Promise<void> {
    try {
      const existing = await browser.storage.local.get(null);
      const toSet: Record<string, unknown> = {};

      for (const [key, defaultValue] of Object.entries(DEFAULT_APP_STORAGE)) {
        if (!(key in existing)) {
          toSet[key] = defaultValue;
        }
      }

      if (Object.keys(toSet).length > 0) {
        await browser.storage.local.set(toSet);
        log.info('Storage initialized with defaults for keys:', Object.keys(toSet));
      }
    } catch (error) {
      log.error('Failed to initialize storage:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  // ── Generic CRUD Helpers ───────────────────────────────────────────────

  private static async get<K extends keyof AppStorage>(key: K): Promise<AppStorage[K]> {
    try {
      const result = await browser.storage.local.get({ [key]: DEFAULT_APP_STORAGE[key] });
      return result[key] as AppStorage[K];
    } catch (error) {
      log.error(`Failed to read key [${key}] from storage:`, error);
      throw error;
    }
  }

  private static async set<K extends keyof AppStorage>(
    key: K,
    value: AppStorage[K]
  ): Promise<void> {
    try {
      await browser.storage.local.set({ [key]: value });
    } catch (error) {
      log.error(`Failed to write key [${key}] to storage:`, error);
      throw error;
    }
  }

  // ── User Settings ──────────────────────────────────────────────────────

  static async getSettings(): Promise<UserSettings> {
    return this.get('settings');
  }

  static async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    const current = await this.getSettings();
    await this.set('settings', { ...current, ...updates });
    log.debug('Updated settings:', updates);
  }

  // ── Backend Token ──────────────────────────────────────────────────────

  static async getToken(): Promise<BackendToken> {
    return this.get('token');
  }

  static async updateToken(updates: Partial<BackendToken>): Promise<void> {
    const current = await this.getToken();
    await this.set('token', { ...current, ...updates });
    log.debug('Updated backend token configuration.');
  }

  // ── Sync Status ────────────────────────────────────────────────────────

  static async getSyncStatus(): Promise<SyncStatus> {
    return this.get('syncStatus');
  }

  static async updateSyncStatus(updates: Partial<SyncStatus>): Promise<void> {
    const current = await this.getSyncStatus();
    await this.set('syncStatus', { ...current, ...updates });
  }

  static async resetSyncError(): Promise<void> {
    await this.updateSyncStatus({ lastError: null, failedCount: 0 });
  }

  // ── Processed Submissions ──────────────────────────────────────────────

  static async getSubmissions(): Promise<ProcessedSubmission[]> {
    return this.get('submissions');
  }

  static async getSubmissionById(id: string): Promise<ProcessedSubmission | undefined> {
    const submissions = await this.getSubmissions();
    return submissions.find((sub) => sub.submissionId === id);
  }

  static async addSubmission(submission: ProcessedSubmission): Promise<void> {
    const submissions = await this.getSubmissions();
    // Filter out any existing submission with the same ID to prevent duplicates
    const filtered = submissions.filter((sub) => sub.submissionId !== submission.submissionId);

    filtered.unshift(submission);

    // Optional: cap the array size to prevent unbounded memory growth (e.g. max 1000 items)
    if (filtered.length > 1000) {
      filtered.length = 1000;
    }

    await this.set('submissions', filtered);
    log.debug('Added processed submission:', submission.submissionId);
  }

  static async updateSubmissionStatus(
    id: string,
    status: ProcessedSubmission['status']
  ): Promise<void> {
    const submissions = await this.getSubmissions();
    const index = submissions.findIndex((sub) => sub.submissionId === id);

    if (index !== -1) {
      submissions[index].status = status;
      await this.set('submissions', submissions);
      log.debug(`Updated submission ${id} status to ${status}`);
    } else {
      log.warn(`Cannot update status: Submission ${id} not found.`);
    }
  }

  static async removeSubmission(id: string): Promise<void> {
    const submissions = await this.getSubmissions();
    const filtered = submissions.filter((sub) => sub.submissionId !== id);
    await this.set('submissions', filtered);
    log.debug('Removed submission:', id);
  }
}
