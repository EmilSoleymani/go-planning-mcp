import { describe, expect, it, vi } from "vitest";

import { TtlCache, cacheEnabledFromEnv } from "./cache.js";

describe("TtlCache", () => {
  it("returns the cached value on a second call within the TTL", async () => {
    const cache = new TtlCache();
    const fetcher = vi.fn().mockResolvedValue("value");

    await cache.getOrFetch("key", 10_000, fetcher);
    const second = await cache.getOrFetch("key", 10_000, fetcher);

    expect(second).toBe("value");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    try {
      const cache = new TtlCache();
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce("first")
        .mockResolvedValueOnce("second");

      await cache.getOrFetch("key", 1000, fetcher);
      vi.advanceTimersByTime(1001);
      const value = await cache.getOrFetch("key", 1000, fetcher);

      expect(value).toBe("second");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bypasses caching entirely when disabled", async () => {
    const cache = new TtlCache({ enabled: false });
    const fetcher = vi.fn().mockResolvedValue("value");

    await cache.getOrFetch("key", 10_000, fetcher);
    await cache.getOrFetch("key", 10_000, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keys entries independently", async () => {
    const cache = new TtlCache();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("a")
      .mockResolvedValueOnce("b");

    expect(await cache.getOrFetch("a", 10_000, fetcher)).toBe("a");
    expect(await cache.getOrFetch("b", 10_000, fetcher)).toBe("b");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("cacheEnabledFromEnv", () => {
  it("defaults to enabled when unset", () => {
    expect(cacheEnabledFromEnv(undefined)).toBe(true);
  });

  it.each(["false", "FALSE", "0", " false "])("disables on %j", (value) => {
    expect(cacheEnabledFromEnv(value)).toBe(false);
  });

  it.each(["true", "1", "yes", ""])("stays enabled on %j", (value) => {
    expect(cacheEnabledFromEnv(value)).toBe(true);
  });
});
