import { createLogger } from '../utils/logger';
import { LeetCodeGraphQLService } from '../services/LeetCodeGraphQLService';
import { StorageService } from '../services/StorageService';

const log = createLogger('Scheduler');

const SNAPSHOT_ALARM_NAME = 'snapshot-sync';
const SNAPSHOT_INTERVAL_MINUTES = 1440; // 24 hours

interface BrowserAlarms {
  alarms: {
    onAlarm: { addListener: (cb: (alarm: { name: string }) => void) => void };
    get: (name: string) => Promise<{ name: string } | undefined>;
    create: (name: string, options: { periodInMinutes: number }) => void;
  };
}

export class Scheduler {
  /**
   * Initializes the background jobs.
   */
  static init() {
    log.info('Initializing background scheduler');

    const browserApi = browser as unknown as BrowserAlarms;

    // Setup listener
    browserApi.alarms.onAlarm.addListener(this.handleAlarm.bind(this));

    // Ensure alarm is created
    browserApi.alarms
      .get(SNAPSHOT_ALARM_NAME)
      .then((alarm) => {
        if (!alarm) {
          log.info(`Creating new alarm: ${SNAPSHOT_ALARM_NAME}`);
          browserApi.alarms.create(SNAPSHOT_ALARM_NAME, {
            periodInMinutes: SNAPSHOT_INTERVAL_MINUTES,
          });

          // Run an initial sync on startup asynchronously
          setTimeout(() => {
            this.syncSnapshot().catch((err) => log.error('Initial snapshot sync failed:', err));
          }, 5000);
        }
      })
      .catch((err) => log.error('Failed to get alarm:', err));
  }

  /**
   * Dispatches alarm events to the correct handlers
   */
  private static handleAlarm(alarm: { name: string }) {
    if (alarm.name === SNAPSHOT_ALARM_NAME) {
      log.info('Snapshot alarm triggered');
      this.syncSnapshot().catch((err) => log.error('Snapshot sync failed:', err));
    }
  }

  /**
   * Core Snapshot Engine Logic
   */
  static async syncSnapshot() {
    try {
      log.info('Starting snapshot sync sequence');

      const settings = await StorageService.getSettings();
      if (!settings.autoSync) {
        log.warn('Extension auto-sync is disabled. Skipping snapshot sync.');
        return;
      }

      const tokenConfig = await StorageService.getToken();
      if (!tokenConfig.accessToken) {
        log.warn('No authentication token found. Cannot sync snapshot.');
        return;
      }

      // Dynamically get the logged-in username
      const username = await LeetCodeGraphQLService.getCurrentUsername();
      if (!username) {
        log.warn('Could not detect logged-in LeetCode username.');
        return;
      }

      log.info(`Fetching snapshot data for user: ${username}`);
      const payload = await LeetCodeGraphQLService.getFullProfileSnapshot(username);

      log.info('Submitting snapshot to backend...');
      const response = await fetch(`${tokenConfig.apiUrl}/api/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenConfig.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
      }

      log.info('✅ Snapshot successfully synchronized.');
    } catch (error: unknown) {
      const lastError = error instanceof Error ? error : new Error(String(error));
      log.error(`Failed to sync snapshot: ${lastError.message}`);
    }
  }
}
