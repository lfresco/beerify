-- =============================================================
-- BeerLog — Storage bucket RLS for the beer-images bucket
-- Run this in the Supabase SQL Editor (Database → SQL Editor)
-- =============================================================
--
-- Path convention enforced by storage.ts:
--   beer_photos/{user_id}/{entry_id}/{timestamp}.ext
-- The [2] element (1-indexed) is therefore user_id.
--
-- Drop existing policies first (idempotent re-apply):
DROP POLICY IF EXISTS "beer_images_read"   ON storage.objects;
DROP POLICY IF EXISTS "beer_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "beer_images_delete" ON storage.objects;
DROP POLICY IF EXISTS "beer_images_update" ON storage.objects;

-- Authenticated users can read any beer photo (closed-group app).
CREATE POLICY "beer_images_read" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'beer-images');

-- Users can only upload into their own user_id subfolder.
CREATE POLICY "beer_images_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'beer-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Users can only delete their own photos.
CREATE POLICY "beer_images_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'beer-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );
