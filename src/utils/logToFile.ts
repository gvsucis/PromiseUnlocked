// Utility to log errors to a file (or AsyncStorage for React Native)
// This is a stub. You can expand it to write to a file or remote logging service.

// Log errors to the console (with timestamp)
export async function logErrorToFile(...args: any[]) {
  const message = `[${new Date().toISOString()}]`;
  // eslint-disable-next-line no-console
  console.error(message, ...args);
}
