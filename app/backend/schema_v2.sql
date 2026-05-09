-- Run this in your Supabase SQL Editor

-- New table: user health profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    conditions JSONB DEFAULT '[]'::jsonb,
    allergies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- Add new columns to existing scans table
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS nutrition JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS additives JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS user_profile_id UUID;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS profile_alerts JSONB DEFAULT '[]'::jsonb;
