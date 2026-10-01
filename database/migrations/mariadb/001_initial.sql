CREATE TABLE IF NOT EXISTS advertisers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL DEFAULT '',
  created_at VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK(kind IN ('website','app')),
  domain VARCHAR(255) NOT NULL DEFAULT '',
  created_at VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS placements (
  id CHAR(36) PRIMARY KEY,
  property_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  width INT NOT NULL CHECK(width>0),
  height INT NOT NULL CHECK(height>0),
  created_at VARCHAR(24) NOT NULL,
  FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) PRIMARY KEY,
  advertiser_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK(status IN ('active','paused')),
  start_at VARCHAR(10) NOT NULL DEFAULT '',
  end_at VARCHAR(10) NOT NULL DEFAULT '',
  daily_cap INT NOT NULL DEFAULT 0 CHECK(daily_cap>=0),
  priority INT NOT NULL DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
  created_at VARCHAR(24) NOT NULL,
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creatives (
  id CHAR(36) PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  target_url VARCHAR(2048) NOT NULL,
  width INT NOT NULL CHECK(width>0),
  height INT NOT NULL CHECK(height>0),
  created_at VARCHAR(24) NOT NULL,
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id CHAR(36) PRIMARY KEY,
  creative_id CHAR(36) NOT NULL,
  campaign_id CHAR(36) NOT NULL,
  placement_id CHAR(36) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK(kind IN ('request','impression','click')),
  occurred_at VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX IF NOT EXISTS idx_placements_property ON placements(property_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_creatives_campaign ON creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_creatives_size ON creatives(width,height);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(campaign_id,kind,occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_placement ON events(placement_id,kind,occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_creative ON events(creative_id,kind,occurred_at);
