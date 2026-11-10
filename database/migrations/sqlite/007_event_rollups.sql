CREATE TABLE IF NOT EXISTS event_daily (
 day TEXT NOT NULL, campaign_id TEXT NOT NULL, creative_id TEXT NOT NULL, placement_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('request','impression','click')), total INTEGER NOT NULL,
 PRIMARY KEY(day,campaign_id,creative_id,placement_id,kind)
);
CREATE INDEX IF NOT EXISTS event_daily_campaign ON event_daily(campaign_id,kind,day);
CREATE INDEX IF NOT EXISTS delivery_created_at ON delivery_requests(created_at);
INSERT OR REPLACE INTO event_daily(day,campaign_id,creative_id,placement_id,kind,total)
 SELECT substr(occurred_at,1,10),campaign_id,creative_id,placement_id,kind,COUNT(*)
 FROM events GROUP BY substr(occurred_at,1,10),campaign_id,creative_id,placement_id,kind;
