
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS long_description TEXT,
  ADD COLUMN IF NOT EXISTS what_you_achieve JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS who_is_for JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS instructor_bio TEXT,
  ADD COLUMN IF NOT EXISTS instructor_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS trailer_video_url TEXT,
  ADD COLUMN IF NOT EXISTS trailer_video_type TEXT DEFAULT 'url';

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS week_number INTEGER,
  ADD COLUMN IF NOT EXISTS day_number INTEGER;
