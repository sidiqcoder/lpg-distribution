CREATE TABLE lpg_private.media_files (
  filename TEXT PRIMARY KEY,
  owner TEXT NOT NULL REFERENCES lpg_private.accounts(username),
  total_size BIGINT NOT NULL CHECK (total_size > 0),
  content_type TEXT NOT NULL,
  parts JSONB NOT NULL,
  uploaded INTEGER[] NOT NULL DEFAULT '{}',
  ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lpg_private.media_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX media_files_owner ON lpg_private.media_files(owner);
