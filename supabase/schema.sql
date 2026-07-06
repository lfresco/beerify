-- =============================================================
-- BeerLog — Supabase Schema
-- Run this in the Supabase SQL Editor (Database → SQL Editor → New query)
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- PROFILES  (1-to-1 with auth.users)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT        UNIQUE NOT NULL,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ──────────────────────────────────────────────────────────────
-- ACCESS ALLOWLIST (email-based signup guard)
-- Only users whose email is listed here can create an auth account.
-- Managed via service_role (admin). RLS is intentionally left off:
-- Postgres role checks alone gate access.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allowed_emails (
  email    TEXT PRIMARY KEY,
  note     TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email is required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email is not authorized. Ask the admin to add you.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_email_allowlist_trigger ON auth.users;
CREATE TRIGGER enforce_email_allowlist_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();

-- Auto-create profile + personal Friends group on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_group_id UUID;
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'preferred_username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.friend_groups WHERE owner_id = NEW.id) THEN
    INSERT INTO public.friend_groups (name, owner_id, description)
    VALUES ('Friends', NEW.id, 'Your personal friends group')
    RETURNING id INTO new_group_id;

    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (new_group_id, NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ──────────────────────────────────────────────────────────────
-- BEER STYLES  (lookup / catalog)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beer_styles (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        UNIQUE NOT NULL,
  category    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- BEER BRANDS  (catalog — populated by ingestion)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beer_brands (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        UNIQUE NOT NULL,
  brewery     TEXT,
  country     TEXT,
  style_id    INT         REFERENCES beer_styles(id) ON DELETE SET NULL,
  abv         NUMERIC(5,2),
  description TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beer_brands_name ON beer_brands(name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_beer_brands_style ON beer_brands(style_id);

-- ──────────────────────────────────────────────────────────────
-- FRIEND GROUPS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT,
  invite_code TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friend_groups_owner ON friend_groups(owner_id);

CREATE TABLE IF NOT EXISTS group_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID        NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

-- ──────────────────────────────────────────────────────────────
-- INVITES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_token TEXT        UNIQUE NOT NULL,
  email        TEXT,
  group_id     UUID        REFERENCES friend_groups(id) ON DELETE SET NULL,
  used_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invites_token    ON invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_invites_referrer ON invites(referrer_id);

-- ──────────────────────────────────────────────────────────────
-- BEER ENTRIES  (core entity)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beer_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beer_brand_id INT         REFERENCES beer_brands(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  brewery       TEXT,
  style_id      INT         REFERENCES beer_styles(id) ON DELETE SET NULL,
  abv           NUMERIC(5,2),
  rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes         TEXT,
  tasted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beer_entries_user     ON beer_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_beer_entries_tasted   ON beer_entries(tasted_at DESC);
CREATE INDEX IF NOT EXISTS idx_beer_entries_style    ON beer_entries(style_id);

CREATE TRIGGER beer_entries_updated_at BEFORE UPDATE ON beer_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ──────────────────────────────────────────────────────────────
-- PHOTOS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  beer_entry_id  UUID        NOT NULL REFERENCES beer_entries(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(beer_entry_id);
CREATE INDEX IF NOT EXISTS idx_photos_user  ON photos(user_id);

-- ──────────────────────────────────────────────────────────────
-- LIKES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  beer_entry_id  UUID        NOT NULL REFERENCES beer_entries(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (beer_entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_entry ON likes(beer_entry_id);
CREATE INDEX IF NOT EXISTS idx_likes_user  ON likes(user_id);

-- ──────────────────────────────────────────────────────────────
-- COMMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  beer_entry_id  UUID        NOT NULL REFERENCES beer_entries(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content        TEXT        NOT NULL CHECK (length(trim(content)) > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entry ON comments(beer_entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_user  ON comments(user_id);

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE beer_styles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE beer_brands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE beer_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user in the same group as a given user?
CREATE OR REPLACE FUNCTION same_group(other_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = other_user_id
  );
$$;

-- Helper: is the current user a member of a specific group?
CREATE OR REPLACE FUNCTION is_group_member(target_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = target_group_id AND user_id = auth.uid()
  );
$$;

-- ── Profiles ──────────────────────────────────────────────────
-- Any authenticated user can read basic profile info (needed for
-- friend search). Writes remain owner-only.
DROP POLICY IF EXISTS "profiles_read" ON profiles;
CREATE POLICY "profiles_read" ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── Beer styles & brands (public read, service-role write) ────
CREATE POLICY "styles_read"  ON beer_styles FOR SELECT USING (true);
CREATE POLICY "brands_read"  ON beer_brands FOR SELECT USING (true);

-- ── Friend groups ─────────────────────────────────────────────
CREATE POLICY "groups_read" ON friend_groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM group_members WHERE group_id = id AND user_id = auth.uid()));

CREATE POLICY "groups_insert" ON friend_groups FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_update" ON friend_groups FOR UPDATE
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ── Group members ─────────────────────────────────────────────
-- Read: see your own memberships OR other members if you're in the same group
-- (uses SECURITY DEFINER helper to avoid recursion)
CREATE POLICY "members_read" ON group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_group_member(group_id)
  );

-- Group owner can add members
DROP POLICY IF EXISTS "members_insert" ON group_members;
CREATE POLICY "members_insert" ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM friend_groups
      WHERE id = group_members.group_id AND owner_id = auth.uid()
    )
  );

-- Group owner can remove members; members can leave themselves
DROP POLICY IF EXISTS "members_delete" ON group_members;
CREATE POLICY "members_delete" ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM friend_groups
      WHERE id = group_members.group_id AND owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Guard: owners cannot be removed from their own group
CREATE OR REPLACE FUNCTION public.prevent_owner_removal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the group owner'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_owner_removal_trigger ON group_members;
CREATE TRIGGER prevent_owner_removal_trigger
  BEFORE DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_removal();

-- ── Invites ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "invites_read" ON invites;
CREATE POLICY "invites_read" ON invites FOR SELECT
  USING (referrer_id = auth.uid() OR used_by = auth.uid());

-- ── Beer entries ──────────────────────────────────────────────
CREATE POLICY "entries_read" ON beer_entries FOR SELECT
  USING (user_id = auth.uid() OR same_group(user_id));

CREATE POLICY "entries_insert" ON beer_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "entries_update" ON beer_entries FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "entries_delete" ON beer_entries FOR DELETE
  USING (user_id = auth.uid());

-- ── Photos ────────────────────────────────────────────────────
CREATE POLICY "photos_read" ON photos FOR SELECT
  USING (user_id = auth.uid() OR same_group(user_id));

CREATE POLICY "photos_insert" ON photos FOR INSERT
  WITH CHECK (user_id = auth.uid() AND
              EXISTS (SELECT 1 FROM beer_entries WHERE id = beer_entry_id AND user_id = auth.uid()));

CREATE POLICY "photos_delete" ON photos FOR DELETE
  USING (user_id = auth.uid());

-- ── Likes ────────────────────────────────────────────────────
CREATE POLICY "likes_read" ON likes FOR SELECT
  USING (user_id = auth.uid() OR same_group(user_id));

CREATE POLICY "likes_insert" ON likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete" ON likes FOR DELETE
  USING (user_id = auth.uid());

-- ── Comments ─────────────────────────────────────────────────
CREATE POLICY "comments_read" ON comments FOR SELECT
  USING (user_id = auth.uid() OR same_group(user_id));

CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_update" ON comments FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete" ON comments FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================
-- STORAGE BUCKETS (run in Supabase Storage tab or via API)
-- =============================================================
-- Create bucket: beer-images (private)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('beer-images', 'beer-images', false)
-- ON CONFLICT DO NOTHING;

-- Storage RLS:
-- CREATE POLICY "beer_images_read" ON storage.objects FOR SELECT
--   USING (bucket_id = 'beer-images' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "beer_images_insert" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'beer-images' AND auth.uid()::text = (string_to_array(name, '/'))[2]);
--
-- CREATE POLICY "beer_images_delete" ON storage.objects FOR DELETE
--   USING (bucket_id = 'beer-images' AND auth.uid()::text = (string_to_array(name, '/'))[2]);
