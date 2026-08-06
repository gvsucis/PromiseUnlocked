import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Too many open files") ||
    msg.includes("EMFILE") ||
    msg.includes("NSPOSIXErrorDomain") ||
    msg.includes("storage")
  );
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < MAX_RETRIES && isTransientError(error)) {
        console.warn(
          `[AsyncStorage] ${label} attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error(`[AsyncStorage] ${label} failed after ${attempt} attempt(s):`, error);
        throw error;
      }
    }
  }
  throw new Error("Unreachable");
}

export async function getJSONFromStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const rawValue = await withRetry(() => AsyncStorage.getItem(key), `getItem("${key}")`);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Error reading storage key "${key}":`, error);
    return fallback;
  }
}

export async function setJSONInStorage<T>(key: string, value: T): Promise<void> {
  await withRetry(() => AsyncStorage.setItem(key, JSON.stringify(value)), `setItem("${key}")`);
}

export async function removeFromStorage(key: string): Promise<void> {
  await withRetry(() => AsyncStorage.removeItem(key), `removeItem("${key}")`);
}

export async function removeManyFromStorage(keys: string[]): Promise<void> {
  await withRetry(() => AsyncStorage.multiRemove(keys), "multiRemove");
}
