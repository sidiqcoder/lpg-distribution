CREATE TABLE lpg_private.r2_files (
  filename TEXT PRIMARY KEY,
  owner TEXT NOT NULL REFERENCES lpg_private.accounts(username),
  object_key TEXT UNIQUE NOT NULL,
  staging_key TEXT UNIQUE NOT NULL,
  total_size BIGINT NOT NULL CHECK (total_size > 0 AND total_size <= 2147483648),
  content_type TEXT NOT NULL CHECK (content_type LIKE 'video/%'),
  purpose TEXT NOT NULL CHECK (purpose IN ('fatigue', 'report', 'migration')),
  capture_id UUID,
  ready BOOLEAN NOT NULL DEFAULT false,
  etag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK ((purpose = 'fatigue') = (capture_id IS NOT NULL)),
  CHECK (purpose <> 'fatigue' OR total_size <= 12582912)
);
ALTER TABLE lpg_private.r2_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lpg_private.r2_files FROM PUBLIC, anon, authenticated;
CREATE INDEX r2_files_owner ON lpg_private.r2_files(owner);
CREATE UNIQUE INDEX r2_files_capture ON lpg_private.r2_files(owner, capture_id) WHERE capture_id IS NOT NULL;
