CREATE TABLE demo_visitors (
  device_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count > 0)
);

CREATE INDEX idx_demo_visitors_last_seen_at ON demo_visitors(last_seen_at);
