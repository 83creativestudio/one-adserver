ALTER TABLE campaigns ADD COLUMN pacing TEXT NOT NULL DEFAULT 'asap' CHECK(pacing IN ('asap','even'));
CREATE TABLE delivery_requests (
 id TEXT PRIMARY KEY, placement_id TEXT NOT NULL, campaign_id TEXT NOT NULL, creative_id TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('filled','empty')), created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 impression_at TEXT, click_at TEXT, name TEXT NOT NULL, image_url TEXT NOT NULL, target_url TEXT NOT NULL,
 width INTEGER NOT NULL, height INTEGER NOT NULL
);
CREATE INDEX delivery_campaign_day ON delivery_requests(campaign_id,created_at);
CREATE INDEX delivery_placement ON delivery_requests(placement_id,created_at);
