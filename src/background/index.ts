/**
 * Background service worker entry point.
 *
 * Registers all top-level event listeners immediately,
 * as required by the event-page lifecycle in Firefox MV3.
 */

import type { ExtensionMessage } from '@/types/messages';
import { handleMessage } from './handler';
import { initializeStorage } from '@/utils/storage';
import { StorageService } from '@/services/StorageService';
import { createLogger } from '@/utils/logger';
import { Scheduler } from './scheduler';

const log = createLogger('Background');

// ── Message listener ─────────────────────────────────────────────
// Must be registered at the top level (not inside an async function
// or callback) so Firefox keeps the listener alive.

browser.runtime.onMessage.addListener((message, sender) => {
  // Return a Promise so the messaging channel stays open
  // until the async handler resolves.
  return handleMessage(message as ExtensionMessage, sender);
});

// ── Install / update lifecycle ───────────────────────────────────

browser.runtime.onInstalled.addListener(async (details) => {
  log.info('Extension installed/updated:', details.reason);

  // Initialize storage with defaults on first install
  await initializeStorage();
  await StorageService.initialize();

  if (details.reason === 'install') {
    log.info('First install — storage initialized with defaults.');
  } else if (details.reason === 'update') {
    log.info('Updated from previous version. Existing data preserved.');
  }
});

// ── Startup listener ─────────────────────────────────────────────

browser.runtime.onStartup.addListener(() => {
  log.info('Browser started. Background service worker activated.');
});

// Initialize alarms and background jobs
Scheduler.init();

log.info('Background script loaded.');
