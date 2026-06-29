const ENV_VAR = "APP_FIREBASE_STORAGE_BUCKET";

/** Returns the configured Firebase Storage bucket name, or undefined if unset. */
export const getStorageBucket = (): string | undefined => process.env[ENV_VAR];

/**
 * Returns the configured Firebase Storage bucket name, or throws if it is unset.
 * `usage` is appended to the error (e.g. " for proof storage") to point at the
 * calling subsystem.
 */
export function requireStorageBucket(usage = ""): string {
  const name = getStorageBucket();
  if (!name) {
    throw new Error(
      `${ENV_VAR} env var is required${usage}. ` +
        "Set it in backend/.env to your Firebase Storage bucket name."
    );
  }
  return name;
}
