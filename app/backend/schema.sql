-- Supabase Schema for InsideOut Project

-- Create the ingredients table
CREATE TABLE public.ingredients (
    name TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    plain TEXT,
    citation TEXT,
    tags JSONB DEFAULT '[]'::jsonb
);

-- Create the scans table
CREATE TABLE public.scans (
    id UUID PRIMARY KEY,
    profile TEXT,
    product_name TEXT,
    product_category TEXT,
    health_score INTEGER,
    overall_status TEXT,
    summary TEXT,
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ingredients JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    alternatives JSONB DEFAULT '[]'::jsonb
);

-- Set up Row Level Security (RLS) policies if needed
-- For public access (easiest for development):
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/insert/update on ingredients" ON public.ingredients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/insert/delete on scans" ON public.scans FOR ALL USING (true) WITH CHECK (true);
