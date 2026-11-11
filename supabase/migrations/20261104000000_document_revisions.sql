ALTER TABLE public.rute_harian ADD COLUMN permintaan_tabung integer NOT NULL DEFAULT 56 CHECK (permintaan_tabung >= 0);
ALTER TABLE public.inspeksi_pagi ADD COLUMN physical_checked boolean NOT NULL DEFAULT false;
ALTER TABLE public.inspeksi_pagi ADD COLUMN fatigue_checked boolean NOT NULL DEFAULT false;
CREATE TABLE public.route_tracking_samples (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sopir_id integer NOT NULL REFERENCES public.sopir(id),
  captured_at timestamptz NOT NULL DEFAULT now(),
  on_route boolean NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL
);
CREATE INDEX route_tracking_samples_driver_time ON public.route_tracking_samples(sopir_id,captured_at);
ALTER TABLE public.route_tracking_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.route_tracking_samples FROM anon, authenticated;
ALTER TABLE public.kpi_sopir DROP CONSTRAINT kpi_valid;
ALTER TABLE public.kpi_sopir ALTER COLUMN nilai TYPE numeric;
ALTER TABLE public.kpi_sopir ADD CONSTRAINT kpi_valid CHECK (nilai >= 0);
WITH locations(no,nama,lat,lng,permintaan) AS (VALUES
(1, 'Bumdes Antap', -8.530381144598763, 115.00622830864008, 56),
(2, 'Bumdes Tegal Mengkeb', -8.531878376832335, 115.03306401815294, 56),
(3, 'Bupda Mundeh', -8.405273641273649, 114.96296417360969, 56),
(4, 'Gusti Ayu Aris Widiantari', -8.45951232450221, 115.1725296612919, 56),
(5, 'I Dewa Made Arimbawa', -8.518588483129697, 115.09403503878825, 56),
(6, 'I Gede Made Budi Antara', -8.467513295817776, 115.12128714019862, 56),
(7, 'I Made Dwipayana', -8.54467936099417, 115.10257611255447, 56),
(8, 'I Made Rudiawan', -8.50180399872628, 115.03938497842793, 56),
(9, 'I Nengah Wardana', -8.546933888439034, 115.06505580261616, 56),
(10, 'I Nyoman Suteja', -8.453067931481465, 115.06744977716684, 56),
(11, 'I Putu Agus Juniarto', -8.51460741655174, 115.10943496631276, 56),
(12, 'I Putu Kerta Yasa', -8.476126065182193, 115.07781934039713, 56),
(13, 'I Wayan Wana', -8.411347973042671, 115.18057130917124, 56),
(14, 'I Wayan Wirka', -8.559349937369676, 115.07310984287574, 56),
(15, 'Made Suarya Adnyana', -8.493391264012862, 115.04140076509073, 56),
(16, 'Ni Wayan Sekarningsih', -8.438386644678488, 115.09318286825626, 56),
(17, 'Pertashop Sedana Jaya', -8.41232744584101, 115.0315572453532, 56),
(18, 'Toko Gotan', -8.522711149151538, 115.11478793765839, 56),
(19, 'Toko L & E', -8.526549990419037, 115.10419823581145, 56),
(20, 'Wayan Wirasa BS', -8.35645270577523, 115.01366813193852, 56)
)
UPDATE public.rute_harian r SET pangkalan_nama=l.nama, permintaan_tabung=l.permintaan
FROM locations l WHERE r.tanggal >= '2026-11-04' AND r.urutan > 0
AND abs(r.latitude-l.lat)<0.000001 AND abs(r.longitude-l.lng)<0.000001;
WITH ordered AS (
 SELECT id, row_number() OVER (PARTITION BY tanggal,sopir_id ORDER BY urutan,id) AS n
 FROM public.rute_harian WHERE tanggal >= '2026-11-04' AND urutan > 0
)
UPDATE public.rute_harian r SET estimasi_waktu_tiba=(time '09:00' + (o.n-1)*interval '1 hour')::time
FROM ordered o WHERE o.id=r.id;
UPDATE public.rute_harian SET permintaan_tabung=0 WHERE urutan=0 AND tanggal >= '2026-11-04';
