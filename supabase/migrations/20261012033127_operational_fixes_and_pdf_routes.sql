-- Preserve legacy field names and all operational history.
UPDATE public.kendaraan SET tipe_tangki='Truk Engkel' WHERE lower(tipe_tangki)='tangki engkel';
ALTER TABLE public.rute_harian ADD COLUMN sumber text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.rute_harian ADD COLUMN urutan_dokumen integer;
CREATE UNIQUE INDEX rute_harian_document_stop
  ON public.rute_harian(tanggal,sopir_id,sumber,urutan_dokumen)
  WHERE urutan_dokumen IS NOT NULL;
