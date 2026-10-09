ALTER TABLE lpg_private.media_files ADD CONSTRAINT media_parts_array CHECK (jsonb_typeof(parts) = 'array');
