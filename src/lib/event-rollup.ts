import type { Transaction } from '../../database/index.mjs';

export type EventKind = 'request' | 'impression' | 'click';

export async function incrementEventDaily(tx: Transaction, kind: EventKind, row: {creative_id:string;campaign_id:string;placement_id:string}, now: string) {
  const upsert = tx.provider === 'mariadb'
    ? 'ON DUPLICATE KEY UPDATE total=total+1'
    : 'ON CONFLICT(day,campaign_id,creative_id,placement_id,kind) DO UPDATE SET total=event_daily.total+1';
  await tx.prepare(`INSERT INTO event_daily(day,campaign_id,creative_id,placement_id,kind,total) VALUES(?,?,?,?,?,1) ${upsert}`)
    .run(now.slice(0, 10), row.campaign_id, row.creative_id, row.placement_id, kind);
}
