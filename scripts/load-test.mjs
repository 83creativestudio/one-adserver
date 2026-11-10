// Run against a staging installation and a dedicated test placement.
const base = process.env.LOAD_BASE || 'http://127.0.0.1:3000';
const placement = process.env.LOAD_PLACEMENT;
const requests = Number(process.env.LOAD_REQUESTS || 1000);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
if (!placement || !Number.isInteger(requests) || requests < 1 || requests > 100000 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500) {
  throw new Error('Set LOAD_PLACEMENT, LOAD_REQUESTS=1..100000 and LOAD_CONCURRENCY=1..500');
}
if (!/^https?:\/\//.test(base)) throw new Error('LOAD_BASE must be an HTTP origin');
const url = new URL('/api/serve', base);
url.searchParams.set('placement', placement);
let next = 0, failed = 0, filled = 0, empty = 0;
const durations = [];
const started = performance.now();
await Promise.all(Array.from({length: Math.min(concurrency, requests)}, async () => {
  while (next < requests) {
    next++;
    const start = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
      if (!response.ok) { failed++; continue; }
      const body = await response.json();
      if (body.ad) filled++; else empty++;
    } catch { failed++; }
    finally { durations.push(performance.now() - start); }
  }
}));
durations.sort((a,b) => a-b);
const percentile = p => durations[Math.min(durations.length-1, Math.ceil(durations.length*p)-1)]?.toFixed(1) ?? 'n/a';
console.log(JSON.stringify({requests, concurrency, filled, empty, failed, rps: +(requests/((performance.now()-started)/1000)).toFixed(1), p50_ms: percentile(.5), p95_ms: percentile(.95), p99_ms: percentile(.99)}, null, 2));
if (failed) process.exitCode = 1;
