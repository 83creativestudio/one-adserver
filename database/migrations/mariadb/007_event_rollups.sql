CREATE TABLE IF NOT EXISTS event_daily (
 day VARCHAR(10) NOT NULL, campaign_id VARCHAR(36) NOT NULL, creative_id VARCHAR(36) NOT NULL,
 placement_id VARCHAR(36) NOT NULL, kind VARCHAR(16) NOT NULL CHECK(kind IN ('request','impression','click')),
 total BIGINT NOT NULL,
 PRIMARY KEY(day,campaign_id,creative_id,placement_id,kind),
 INDEX event_daily_campaign(campaign_id,kind,day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX IF NOT EXISTS delivery_created_at ON delivery_requests(created_at);
REPLACE INTO event_daily(day,campaign_id,creative_id,placement_id,kind,total)
 SELECT LEFT(occurred_at,10),campaign_id,creative_id,placement_id,kind,COUNT(*)
 FROM events GROUP BY LEFT(occurred_at,10),campaign_id,creative_id,placement_id,kind;
