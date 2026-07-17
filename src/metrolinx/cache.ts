// In-process, best-effort TTL cache (caching spec, ticket 005). No
// dependencies, no invalidation beyond time — full benefit on the
// long-lived Docker process, degrades to a no-op across cold Vercel
// invocations.

export interface CacheOptions {
  enabled?: boolean;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache {
  private readonly enabled: boolean;
  private readonly store = new Map<string, Entry<unknown>>();

  constructor(options: CacheOptions = {}) {
    this.enabled = options.enabled ?? true;
  }

  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) return fetcher();

    const hit = this.store.get(key);
    const now = Date.now();
    if (hit && hit.expiresAt > now) return hit.value as T;

    const value = await fetcher();
    this.store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }
}

/** CACHE_ENABLED env var: disabled only on an explicit "false"/"0"; default on. */
export function cacheEnabledFromEnv(value: string | undefined): boolean {
  if (value === undefined) return true;
  return !["false", "0"].includes(value.trim().toLowerCase());
}
