-- Preserve malformed time values from SQLite without placing them in TIME columns.
ALTER TABLE public.pengiriman ADD COLUMN legacy_waktu_json TEXT;
