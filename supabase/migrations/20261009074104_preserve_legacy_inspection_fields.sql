-- Keep all fields from historical inspections, including the older validation format.
ALTER TABLE public.inspeksi_pagi
  ADD COLUMN foto_tangki TEXT,
  ADD COLUMN status TEXT,
  ADD COLUMN foto_integritas_bak TEXT,
  ADD COLUMN foto_kit_tumpah TEXT,
  ADD COLUMN foto_sopir_fit TEXT,
  ADD COLUMN admin_catatan TEXT,
  ADD COLUMN admin_id INTEGER,
  ADD COLUMN admin_validasi_at TIMESTAMPTZ;
CREATE INDEX rute_harian_kendaraan ON public.rute_harian(kendaraan_id);
