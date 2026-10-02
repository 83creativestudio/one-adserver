CREATE TABLE IF NOT EXISTS campaign_placements (
  campaign_id CHAR(36) NOT NULL,
  placement_id CHAR(36) NOT NULL,
  PRIMARY KEY (campaign_id, placement_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (placement_id) REFERENCES placements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX IF NOT EXISTS idx_campaign_placements_placement ON campaign_placements(placement_id,campaign_id);
