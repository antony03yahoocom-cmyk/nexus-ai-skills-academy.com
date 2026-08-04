ALTER TABLE public.wa_admin_config
  ADD COLUMN IF NOT EXISTS gateway_base_url text,
  ADD COLUMN IF NOT EXISTS gateway_api_key text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_connected boolean,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;