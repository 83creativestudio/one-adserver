import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DB_PROVIDER = 'sqlite';
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'one-adserver-metrics-cache-')), 'test.sqlite');

const { db, create, logEvent } = await import('../src/lib/store.ts');
const { cachedMetrics, warmMetrics } = await import('../src/lib/metrics-cache.ts');

test('metrics cache serves a snapshot immediately and can refresh it', async () => {
  const database = db();
  try {
    await database.migrate();
    const advertiser = await create('advertisers', { name: 'Report advertiser' });
    const campaign = await create('campaigns', { advertiser_id: advertiser.id, name: 'Report campaign' });
    const first = await cachedMetrics();
    assert.equal(first.campaigns.find(row => row.id === campaign.id).impressions, 0);
    assert.ok(first.generatedAt);

    await logEvent('impression', 'creative', campaign.id, 'placement');
    const cached = await cachedMetrics();
    assert.equal(cached.generatedAt, first.generatedAt);
    assert.equal(cached.campaigns.find(row => row.id === campaign.id).impressions, 0);

    const refreshed = await warmMetrics();
    assert.equal(refreshed.campaigns.find(row => row.id === campaign.id).impressions, 1);
    assert.equal((await cachedMetrics()).campaigns.find(row => row.id === campaign.id).impressions, 1);

    await logEvent('click', 'creative', campaign.id, 'placement');
    globalThis.oneAdserverMetricsCache.updatedAt = Date.now() - 60_001;
    const stale = await cachedMetrics();
    assert.equal(stale.campaigns.find(row => row.id === campaign.id).clicks, 0);
    const updated = await warmMetrics();
    assert.equal(updated.campaigns.find(row => row.id === campaign.id).clicks, 1);
  } finally { await database.close(); }
});
