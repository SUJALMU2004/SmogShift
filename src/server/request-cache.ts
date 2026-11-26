type Options = {
  ttlMs: number;
  maxEntries: number;
  clock: () => number;
};

/** Coalesce concurrent loads and retain only bounded, successful results. */
export function createRequestCache<Key, Value>({
  ttlMs,
  maxEntries,
  clock,
}: Options) {
  const cache = new Map<Key, { value: Value; expiresAt: number }>();
  const pending = new Map<Key, Promise<Value>>();

  function remember(key: Key, value: Value): Value {
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { value, expiresAt: clock() + ttlMs });
    return value;
  }

  return async function get(
    key: Key,
    load: () => Promise<Value>,
  ): Promise<Value> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > clock()) return cached.value;
    if (cached) cache.delete(key);

    const active = pending.get(key);
    if (active) return active;

    const request = Promise.resolve()
      .then(load)
      .then((value) => remember(key, value))
      .finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
