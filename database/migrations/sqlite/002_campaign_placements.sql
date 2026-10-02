CREATE TABLE campaign_placements (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  placement_id TEXT NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, placement_id)
);
CREATE INDEX idx_campaign_placements_placement ON campaign_placements(placement_id,campaign_id);
