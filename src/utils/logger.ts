/**
 * Namespaced logger with debug-mode gating.
 *
 * Usage:
 *   const log = createLogger('ContentScript');
 *   log.info('Detected submission', data);
 */

const PREFIX = '[LeetCommit]';

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(namespace: string): Logger {
  const tag = `${PREFIX}[${namespace}]`;

  return {
    info: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.info(tag, ...args);
    },

    warn: (...args: unknown[]) => {
      console.warn(tag, ...args);
    },

    error: (...args: unknown[]) => {
      console.error(tag, ...args);
    },

    debug: (...args: unknown[]) => {
      // Debug logs are always written — gating can be added later
      // via a storage-backed check if needed.
      // eslint-disable-next-line no-console
      console.debug(tag, ...args);
    },
  };
}
