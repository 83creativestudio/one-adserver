import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../database/index.mjs';
import { db, create, list, update, remove, logEvent, metrics } from '../src/lib/store.ts';

process.env.DB_PROVIDER = process.env.TEST_DB_PROVIDER || 'sqlite';
if (process.env.DB_PROVIDER === 'sqlite') {
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'one-adserver-db-test-')), 'test.sqlite');
} else if (!/^one_adserver_test_/.test(process.env.DB_NAME || '')) {
  throw new Error('MariaDB tests require an isolated DB_NAME beginning one_adserver_test_');
}

test('rejects an unknown provider', () => {
  assert.throws(() => createDatabase({ DB_PROVIDER: 'unknown' }), /DB_PROVIDER/);
});

test('migrations, persistence, relationships, reporting and CRUD work on both providers', async () => {
  const database = db();
  try {
    await database.migrate();
    await database.migrate();
    const versions = await database.prepare('SELECT * FROM schema_migrations').all();
    assert.equal(versions.length, 5);
    const advertiser = await create('advertisers', { name: 'Δοκιμή 🟢', contact_email: 'test@example.com' });
    const property = await create('properties', { name: 'Test property', kind: 'website', domain: 'example.com' });
    const placement = await create('placements', { property_id: property.id, name: 'Banner', width: 300, height: 250 });
    const campaign = await create('campaigns', { advertiser_id: advertiser.id, name: 'Test campaign', status: 'active', daily_cap: 100, priority: 5 });
    const creative = await create('creatives', { campaign_id: campaign.id, name: 'Banner image', image_url: 'https://example.com/ad.png', target_url: 'https://example.com/', width: 300, height: 250 });
    assert.ok((await list('advertisers')).some(row => row.name === 'Δοκιμή 🟢'));
    assert.equal(typeof placement.width, 'number');
    assert.equal((await update('campaigns', campaign.id, { status: 'paused' })).status, 'paused');
    assert.equal(await update('campaigns', 'missing', { name: 'Missing' }), null);
    await assert.rejects(create('placements', { property_id: 'missing', name: 'Broken', width: 300, height: 250 }));
    await assert.rejects(create('campaigns', { advertiser_id: advertiser.id, name: 'Broken', status: 'invalid' }));
    await assert.rejects(create('advertisers', { name: 'a'.repeat(256) }));
    await Promise.all(['request', 'impression', 'click'].map(kind => logEvent(kind, creative.id, campaign.id, placement.id)));
    const stats = await metrics();
    assert.equal(typeof stats.totals.impression, 'number');
    assert.ok(stats.totals.impression >= 1);
    const report = stats.campaigns.find(row => row.id === campaign.id);
    assert.equal(report.impressions, 1);
    assert.equal(report.clicks, 1);
    assert.doesNotThrow(() => JSON.stringify(stats));
    await database.close();
    assert.equal((await database.prepare('SELECT name FROM advertisers WHERE id=?').get(advertiser.id)).name, 'Δοκιμή 🟢');
    assert.equal(await remove('advertisers', advertiser.id), true);
    assert.equal(await database.prepare('SELECT id FROM campaigns WHERE id=?').get(campaign.id), undefined);
    assert.equal(await database.prepare('SELECT id FROM creatives WHERE id=?').get(creative.id), undefined);
    // Historical delivery events survive deletion of their campaign.
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM events WHERE campaign_id=?').get(campaign.id)).total, 3);
    await database.prepare('DELETE FROM events WHERE campaign_id=?').run(campaign.id);
    await remove('properties', property.id);
    assert.equal(await database.prepare('SELECT id FROM placements WHERE id=?').get(placement.id), undefined);
    assert.equal(await remove('properties', property.id), false);
  } finally { await database.close(); }
});

test('adopts an existing SQLite database without losing rows', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const path = join(mkdtempSync(join(tmpdir(), 'one-adserver-legacy-test-')), 'legacy.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE advertisers(id TEXT PRIMARY KEY,name TEXT NOT NULL,contact_email TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL); INSERT INTO advertisers VALUES ('existing','Existing advertiser','','2026-01-01T00:00:00.000Z')");
  legacy.close();
  const database = createDatabase({ DB_PROVIDER: 'sqlite', DATABASE_PATH: path });
  try {
    await database.migrate();
    assert.equal((await database.prepare('SELECT name FROM advertisers WHERE id=?').get('existing')).name, 'Existing advertiser');
  } finally { await database.close(); }
});
