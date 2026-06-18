/**
 * Typed helpers for browser.storage.local.
 *
 * Wraps the raw WebExtension API with generics so callers
 * don't need to cast or assert at every call site.
 */

import type { StorageSchema } from '@/types/storage';
import { DEFAULT_STORAGE } from '@/types/storage';

/**
 * Retrieve one or more keys from local storage with type safety.
 */
export async function getStorage<K extends keyof StorageSchema>(
  keys: K | K[]
): Promise<Pick<StorageSchema, K>> {
  const keyArray = Array.isArray(keys) ? keys : [keys];

  // Build a defaults object for the requested keys
  const defaults: Record<string, unknown> = {};
  for (const key of keyArray) {
    defaults[key] = DEFAULT_STORAGE[key];
  }

  const result = await browser.storage.local.get(defaults);
  return result as Pick<StorageSchema, K>;
}

/**
 * Set one or more keys in local storage.
 */
export async function setStorage(values: Partial<StorageSchema>): Promise<void> {
  await browser.storage.local.set(values);
}

/**
 * Increment a numeric counter in storage atomically.
 */
export async function incrementCounter(
  key: 'totalDetected' | 'totalSent' | 'totalFailed',
  amount = 1
): Promise<number> {
  const current = await getStorage(key);
  const newValue = (current[key] as number) + amount;
  await setStorage({ [key]: newValue });
  return newValue;
}

/**
 * Initialize storage with defaults on first install.
 * Only sets keys that don't already exist.
 */
export async function initializeStorage(): Promise<void> {
  const existing = await browser.storage.local.get(null);
  const toSet: Record<string, unknown> = {};

  for (const [key, defaultValue] of Object.entries(DEFAULT_STORAGE)) {
    if (!(key in existing)) {
      toSet[key] = defaultValue;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await browser.storage.local.set(toSet);
  }
}
