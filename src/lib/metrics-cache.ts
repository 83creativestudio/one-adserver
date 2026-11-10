import { metrics } from './store.ts';

type Snapshot = Awaited<ReturnType<typeof metrics>> & { generatedAt: string };
type Cache = { snapshot?: Snapshot; updatedAt: number; pending?: Promise<Snapshot> };
const cacheGlobal = globalThis as typeof globalThis & { oneAdserverMetricsCache?: Cache };
const cache = cacheGlobal.oneAdserverMetricsCache ??= { updatedAt: 0 };
const refreshAfterMs = 60_000;

function refresh(): Promise<Snapshot> {
  if (cache.pending) return cache.pending;
  const pending = metrics().then(result => {
    const snapshot = { ...result, generatedAt: new Date().toISOString() };
    cache.snapshot = snapshot;
    cache.updatedAt = Date.now();
    cache.pending = undefined;
    return snapshot;
  }, error => {
    cache.pending = undefined;
    throw error;
  });
  cache.pending = pending;
  return pending;
}

export function cachedMetrics(): Promise<Snapshot> {
  if (!cache.snapshot) return refresh();
  if (Date.now() - cache.updatedAt >= refreshAfterMs && !cache.pending) {
    void refresh().catch(error => console.error('Could not refresh adserver metrics:', error));
  }
  return Promise.resolve(cache.snapshot);
}

export function warmMetrics(): Promise<Snapshot> {
  return refresh();
}
