// Lightweight logger that prefixes messages with a tag and timestamp
// so we can trace backend connectivity in the Metro/Expo terminal.

const ts = () => new Date().toISOString();

export const log = {
  info: (tag: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [${tag}]`, ...args);
  },
  warn: (tag: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(`[${ts()}] [${tag}]`, ...args);
  },
  error: (tag: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(`[${ts()}] [${tag}]`, ...args);
  },
};
