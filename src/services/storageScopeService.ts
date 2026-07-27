let currentScopedUid: string | null = null;

export function setScopedStorageUid(uid: string | null): void {
  currentScopedUid = uid;
}

export async function getScopedStorageKey(baseKey: string): Promise<string> {
  const scope = currentScopedUid ?? "signed_out";
  return `${baseKey}:${scope}`;
}
