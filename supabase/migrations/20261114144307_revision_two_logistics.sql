-- Per-location manual input is independent of driver assignments and route order.
CREATE TABLE public.location_demands (
  tanggal date NOT NULL,
  location_no integer NOT NULL CHECK (location_no BETWEEN 1 AND 20),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 100000),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tanggal,location_no)
);
ALTER TABLE public.location_demands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.location_demands FROM anon,authenticated;

CREATE TABLE lpg_private.route_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from date NOT NULL,
  plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lpg_private.route_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lpg_private.route_plans FROM PUBLIC,anon,authenticated;
CREATE INDEX route_plans_effective ON lpg_private.route_plans(effective_from DESC,id DESC);

-- Keep the capture ID to prevent a delayed retry from recreating deleted media.
ALTER TABLE public.fatigue_reports ADD COLUMN media_deleted_at timestamptz;
ALTER TABLE public.fatigue_reports ADD COLUMN media_deleted_by text;
ALTER TABLE public.fatigue_reports ADD COLUMN deleted_media jsonb;
