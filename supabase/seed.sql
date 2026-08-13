-- =============================================================
-- BeerLog — Local development seed data
-- Run after applying schema.sql (via `supabase db reset` or psql)
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- Allow-list the seed users
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.allowed_emails (email, note) VALUES
  ('alice@example.com', 'seed user'),
  ('bob@example.com',   'seed user'),
  ('carol@example.com', 'seed user')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Auth users (bypasses allowlist trigger via direct insert)
-- Passwords are all "password123" hashed with bcrypt.
-- ──────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'alice@example.com',
    '$2a$10$PX.NzDlGl3Y1s.sHpDlVGecUVhiOeO/EHbKUmK8Fq0dFcFLYvwVGW',
    now(), '{"preferred_username": "alice"}', now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bob@example.com',
    '$2a$10$PX.NzDlGl3Y1s.sHpDlVGecUVhiOeO/EHbKUmK8Fq0dFcFLYvwVGW',
    now(), '{"preferred_username": "bob"}', now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'carol@example.com',
    '$2a$10$PX.NzDlGl3Y1s.sHpDlVGecUVhiOeO/EHbKUmK8Fq0dFcFLYvwVGW',
    now(), '{"preferred_username": "carol"}', now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- Profiles (the trigger creates them, but seed directly for reliability)
INSERT INTO public.profiles (id, username, display_name, bio) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice', 'Alice Hops', 'IPA lover 🍺'),
  ('22222222-2222-2222-2222-222222222222', 'bob',   'Bob Brewer', 'Sour beer aficionado'),
  ('33333333-3333-3333-3333-333333333333', 'carol', 'Carol Pils', 'Lager purist')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Beer styles (subset — full list loaded via /catalog/ingest)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.beer_styles (name, category) VALUES
  ('IPA',            'Ale'),
  ('Double IPA',     'Ale'),
  ('Stout',          'Ale'),
  ('Pilsner',        'Lager'),
  ('Hefeweizen',     'Ale'),
  ('Sour / Lambic',  'Sour'),
  ('Pale Ale',       'Ale'),
  ('Lager',          'Lager'),
  ('Wheat Beer',     'Ale'),
  ('Porter',         'Ale')
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Beer brands
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.beer_brands (name, brewery, abv) VALUES
  ('Punk IPA',        'BrewDog',        5.6),
  ('Leffe Blonde',    'Brasserie Leffe', 6.6),
  ('Paulaner Weizen', 'Paulaner',        5.5),
  ('Guinness',        'St. James Gate', 4.2),
  ('Peroni Nastro',   'Peroni',          5.1),
  ('Delirium Tremens','Huyghe',          8.5),
  ('Chimay Blue',     'Abbaye de Scourmont', 9.0),
  ('Sierra Nevada PA','Sierra Nevada',   5.6),
  ('Schneider Weisse','Schneider',       5.4),
  ('Cantillon Gueuze','Cantillon',       5.0),
  ('Birra Moretti',   'Heineken Italia', 4.6),
  ('Augustiner Helles','Augustiner-Bräu', 5.2),
  ('Vedett Extra White','Duvel Moortgat', 4.7),
  ('Orval',           'Abbaye d''Orval', 6.2),
  ('La Chouffe',      'Brasserie d''Achouffe', 8.0)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Friend requests (alice ↔ bob accepted, alice → carol pending)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.friend_requests (requester_id, recipient_id, status, responded_at) VALUES
  ('11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'accepted', now()),
  ('11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   'pending', null)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Beer entries
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.beer_entries (id, user_id, name, brewery, rating, notes, location_type, place_name, city, tasted_at) VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Punk IPA', 'BrewDog', 4,
   'Crisp and bitter, perfect summer IPA.',
   'bar', 'The Craft Tap', 'London',
   now() - interval '1 day'),

  ('aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Leffe Blonde', 'Brasserie Leffe', 5,
   'Classic Belgian bliss.',
   'home', null, 'Milan',
   now() - interval '3 days'),

  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222',
   'Cantillon Gueuze', 'Cantillon', 5,
   'Mind-blowing. Worth every cent.',
   'bar', 'Birreria Roma', 'Rome',
   now() - interval '2 days'),

  ('aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222',
   'Delirium Tremens', 'Huyghe', 4,
   'Pink elephants everywhere.',
   'bar', 'De Koninck Tap', 'Antwerp',
   now() - interval '5 days'),

  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'Augustiner Helles', 'Augustiner-Bräu', 5,
   'The best Helles in the world. No debate.',
   'bar', 'Augustinerkeller', 'Munich',
   now() - interval '7 days'),

  ('aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Chimay Blue', 'Abbaye de Scourmont', 5,
   'Rich, dark, perfect with cheese.',
   'home', null, 'Paris',
   now() - interval '10 days'),

  ('aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222',
   'Sierra Nevada PA', 'Sierra Nevada', 3,
   'A bit flat for a PA. Expected more.',
   'city', null, 'Barcelona',
   now() - interval '14 days'),

  ('aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'Peroni Nastro', 'Peroni', 3,
   'Fine for a hot day, nothing special.',
   'bar', 'Trattoria Centrale', 'Naples',
   now() - interval '4 days'),

  ('aaaaaaaa-0009-0009-0009-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Paulaner Weizen', 'Paulaner', 4,
   'Smooth and creamy, banana notes on point.',
   'bar', 'Bierhaus Wien', 'Vienna',
   now() - interval '20 days'),

  ('aaaaaaaa-0010-0010-0010-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'Orval', 'Abbaye d''Orval', 5,
   'Unique Brett character. A true classic.',
   'home', null, 'Brussels',
   now() - interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Likes
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.likes (beer_entry_id, user_id) VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0010-0010-0010-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Comments
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.comments (beer_entry_id, user_id, content) VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222',
   'Love Punk IPA! Try the Hazy Jane next time 🤙'),
  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Cantillon is the GOAT. Jealous!'),
  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333',
   'Nothing beats Augustiner in the biergarten 🌳')
ON CONFLICT DO NOTHING;
