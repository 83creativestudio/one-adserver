ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pacing VARCHAR(10) NOT NULL DEFAULT 'asap' CHECK(pacing IN ('asap','even'));
CREATE TABLE IF NOT EXISTS delivery_requests (
 id CHAR(36) PRIMARY KEY, placement_id CHAR(36) NOT NULL, campaign_id VARCHAR(36) NOT NULL, creative_id VARCHAR(36) NOT NULL,
 outcome VARCHAR(10) NOT NULL CHECK(outcome IN ('filled','empty')), created_at VARCHAR(24) NOT NULL, expires_at VARCHAR(24) NOT NULL,
 impression_at VARCHAR(24), click_at VARCHAR(24), name VARCHAR(255) NOT NULL, image_url VARCHAR(2048) NOT NULL, target_url VARCHAR(2048) NOT NULL,
 width INT NOT NULL, height INT NOT NULL,
 INDEX delivery_campaign_day(campaign_id,created_at), INDEX delivery_placement(placement_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
