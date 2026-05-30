-- Store the current Google Meet link used by the student dashboard live-class button.
INSERT INTO public.app_settings(key, value)
VALUES ('live_class_url', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
