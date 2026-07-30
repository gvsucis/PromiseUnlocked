export function ttlCache<T>(ttlMs: number) {
  let data: { value: T; at: number } | null = null;

  return {
    get(): T | null {
      if (data === null) return null;
      if (Date.now() - data.at >= ttlMs) {
        data = null;
        return null;
      }
      return data.value;
    },
    set(value: T): void {
      data = { value, at: Date.now() };
    },
    invalidate(): void {
      data = null;
    },
  };
}
