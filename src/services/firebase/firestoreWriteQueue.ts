let firestoreWriteQueue: Promise<void> = Promise.resolve();
const retryBuffer: Array<() => Promise<void>> = [];

async function runWriteTask(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error("[FirestoreQueue] write failed:", error);
    // Keep failed tasks for a later foreground-triggered retry.
    retryBuffer.push(task);
  }
}

/**
 * Enqueue a Firestore write task to run in-order.
 * Errors are logged and do not stop later queued writes.
 */
export function enqueueFirestoreWrite(task: () => Promise<void>): void {
  firestoreWriteQueue = firestoreWriteQueue.then(() => runWriteTask(task));
}

/**
 * Retry writes that failed earlier (for example while the app was backgrounded).
 */
export function flushPendingFirestoreWrites(): Promise<void> {
  if (retryBuffer.length === 0) {
    return firestoreWriteQueue;
  }

  const pending = [...retryBuffer];
  retryBuffer.length = 0;

  for (const task of pending) {
    firestoreWriteQueue = firestoreWriteQueue.then(() => runWriteTask(task));
  }

  return firestoreWriteQueue;
}
