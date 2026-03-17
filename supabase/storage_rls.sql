-- Storage RLS policies for program-assets bucket
-- Run this once against your Supabase project

-- Ensure the bucket exists and is public (URLs are publicly readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-assets', 'program-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access (anyone can fetch logos/photos via getPublicUrl)
CREATE POLICY "program-assets: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'program-assets');

-- Authenticated users can upload new assets
CREATE POLICY "program-assets: auth insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'program-assets');

-- Authenticated users can overwrite/update existing assets
CREATE POLICY "program-assets: auth update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'program-assets');

-- Authenticated users can delete assets
CREATE POLICY "program-assets: auth delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'program-assets');
