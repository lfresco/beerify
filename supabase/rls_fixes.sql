-- =============================================================
-- BeerLog — RLS policy fixes
-- Addresses findings from the 2026-08-13 audit.
-- Run in the Supabase SQL Editor.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- FIX 1: profiles_insert — add TO authenticated role guard
-- Without it the anon role could satisfy auth.uid() checks.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- FIX 2: beer_styles / beer_brands — add role guard on public reads
-- Prevents anonymous clients from scraping the catalog via PostgREST.
-- If you intentionally want public (unauthenticated) catalog access,
-- revert to USING (true) without the TO clause.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "styles_read" ON beer_styles;
CREATE POLICY "styles_read" ON beer_styles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "brands_read" ON beer_brands;
CREATE POLICY "brands_read" ON beer_brands FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- FIX 3: friend_requests_delete — scope recipient delete to pending only
-- Previously recipients could erase rejected requests, hiding history
-- from the requester. Scope to pending for both parties.
--
-- NOTE: If you want recipients to be able to clean up rejected
-- requests from their own view, keep the original policy.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "friend_requests_delete" ON friend_requests;
CREATE POLICY "friend_requests_delete" ON friend_requests FOR DELETE
  TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'pending')
    OR (recipient_id = auth.uid() AND status = 'pending')
  );
