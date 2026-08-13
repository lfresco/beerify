# BeerLog — Security & Code Quality Audit

**Date:** 2026-08-13  
**Scope:** Full-stack — FastAPI backend, TypeScript/React frontend, Supabase (Postgres + Auth + Storage)

---

## Prioritised Findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | **CRITICAL** | Secrets | Real Supabase anon key committed to git in `frontend/.env` (commit `0bb5a72`) |
| 2 | **CRITICAL** | Secrets | `backend/.env` committed in the same commit — likely contains service_role key |
| 3 | **HIGH** | Backend/Auth | Single `service_role` Supabase client used for all backend ops — bypasses RLS on every call |
| 4 | **HIGH** | Backend/Auth | `admin_secret` defaults to `"change-me"` in `config.py` |
| 5 | **HIGH** | Backend | No rate limiting on any public or authenticated endpoint |
| 6 | **HIGH** | RLS | Storage policies commented-out in `schema.sql` — bucket may have no access controls |
| 7 | **MEDIUM** | Backend/Auth | `_verify_hs256_legacy` path swallows all `JWTError` details, masking decode failures |
| 8 | **MEDIUM** | Frontend/Types | `any` cast on all Supabase join responses in `useFeed`, `useStats`, `PublicProfilePage` |
| 9 | **MEDIUM** | Frontend | Stats leaderboard fetches **all** profiles + all their entries with no pagination |
| 10 | **MEDIUM** | RLS | `profiles_insert` policy has no `TO authenticated` role guard |
| 11 | **MEDIUM** | RLS | `friend_requests_delete` allows recipient to delete rejected requests (likely not intended) |
| 12 | **MEDIUM** | Frontend | `useCurrentCity()` called with `void` inside JSX event — errors silently dropped |
| 13 | **LOW** | Frontend | Feed map response shape duplicated verbatim in `useFeed` and `PublicProfilePage` |
| 14 | **LOW** | Frontend | `authInitialized` module-level flag breaks HMR in dev and double-initialises on fast refresh |
| 15 | **LOW** | Frontend | `avatar_url` rendered directly into `<img src>` without sanitisation (low-risk with CSP) |
| 16 | **LOW** | Backend | `__pycache__` committed to git (commit `0bb5a72`) |
| 17 | **LOW** | Deps | `python-jose 3.5.0` — latest is 3.5.x, no known critical CVEs but RSA key confusion was patched in 3.3.0; confirm version is 3.5.0+ ✓ |

---

## Phase 1 — Backend Audit (FastAPI)

### 1.1 Route Map

| Method | Path | Auth required | Tables / actions |
|--------|------|---------------|-----------------|
| GET | `/health` | None | — |
| GET | `/catalog/styles` | None | `beer_styles` SELECT |
| GET | `/catalog/brands` | None | `beer_brands` SELECT |
| POST | `/catalog/ingest` | `X-Admin-Key` header | `beer_styles` UPSERT, `beer_brands` UPSERT, OpenBeerDB HTTP |
| GET | `/invites/{token}/preview` | None | `invites` SELECT (join `friend_groups`, `profiles`) |
| POST | `/invites/` | JWT bearer | `friend_groups` SELECT, `invites` INSERT |
| POST | `/invites/accept` | JWT bearer | `invites` SELECT/UPDATE, `group_members` SELECT/INSERT |
| GET | `/friends/requests` | JWT bearer | `friend_requests` SELECT (join `profiles`) |
| POST | `/friends/requests` | JWT bearer | `profiles` SELECT, `friend_requests` SELECT/INSERT |
| POST | `/friends/requests/{id}/accept` | JWT bearer | `friend_requests` SELECT/UPDATE |
| POST | `/friends/requests/{id}/decline` | JWT bearer | `friend_requests` SELECT/UPDATE |
| DELETE | `/friends/requests/{id}` | JWT bearer | `friend_requests` SELECT/DELETE |

The `/catalog/styles` and `/catalog/brands` public read endpoints are appropriate — no user data exposed.  
`/invites/{token}/preview` is intentionally unauthenticated (pre-login flow), and leaks only inviter display name + group name, which is fine.

### 1.2 service_role Key Usage

**Finding (HIGH — #3):** `supabase_client.py` creates a single global `Client` using `service_role_key`. This client is used for **every** backend operation, including reads that a user-scoped JWT client could safely perform. The service_role key bypasses all RLS policies.

While the backend never forwards this key to the frontend, the pattern is riskier than necessary:

- If any route mistakenly echoes back a Supabase response that includes internal metadata, or if a new route is added that does a broad SELECT without filtering, RLS provides no backstop.
- The invite `accept` route inserts into `group_members` on behalf of the user — correct to use service_role here since the RLS policy requires an owner check that the user JWT can't satisfy in this flow. This is the legitimate use.
- The `friend_requests` read/write routes could operate under the user's JWT instead, letting RLS enforce access automatically.

**Recommendation:** Keep service_role only for admin operations (`/catalog/ingest`, `invites/accept` group-member insert). Add a second user-scoped client factory that accepts a Bearer token and use it on authenticated user routes. See fix in §Fixes.

### 1.3 Input Validation & Error Handling

- `CreateInviteRequest` and `AcceptInviteRequest` use Pydantic v2 — correct.
- `CreateFriendRequestBody` validates `recipient_id: str` but does not validate it is a UUID — a non-UUID string will hit Postgres and return a 500 rather than a 422. Fix: use `uuid.UUID` type annotation.
- Token length check `len(token) < 16` in the invite endpoints is a useful sanity guard.
- `catalog.ingest` catches broad `Exception` and returns partial status — acceptable for an admin-only endpoint.
- **No rate limiting on any endpoint.** The invite preview (`GET /invites/{token}/preview`) is unauthenticated and performs a Supabase query on every call — a token enumeration loop could probe thousands of tokens per second. Add rate limiting (e.g. `slowapi`) at minimum on unauthenticated endpoints.

### 1.4 Secrets Management

- **CRITICAL (#1, #2):** `frontend/.env` and `backend/.env` were committed in git commit `0bb5a72`. The Supabase anon key and likely the service_role key are in git history. **Rotate both keys immediately in the Supabase dashboard.**
- The `.gitignore` correctly excludes `.env` and `.env.*` — these files were added before the gitignore rule took effect (or were force-added).
- `admin_secret` defaults to `"change-me"` — the config comment warns about it, but Pydantic does not enforce a non-default value at startup. Add a startup validator.
- No secrets appear in log output — `console.error` / `print()` calls don't log key material. ✓
- `render.yaml` correctly uses `sync: false` for all sensitive vars (filled in Render dashboard, not in file). ✓

### 1.5 CORS Configuration

CORS is correctly configured via `settings.allowed_origins()` which parses `FRONTEND_ORIGIN` and `FRONTEND_ORIGINS` from environment. No wildcard `*`. ✓

`allow_credentials=True` is needed for the browser to send the `Authorization` header; this is correct since the frontend sends `Bearer` tokens explicitly, though note that `allow_credentials=True` with explicit origins (not `*`) is the safe pattern. ✓

### 1.6 Dependency CVEs

| Package | Locked version | Status |
|---------|---------------|--------|
| `fastapi` | 0.137.1 | ✓ Current in pinned range |
| `starlette` | 1.3.1 | ✓ |
| `python-jose` | 3.5.0 | ✓ RSA confusion patched in 3.3.0; no critical open CVEs |
| `httpx` | 0.28.x | ✓ |
| `supabase-py` | 2.31.x | ✓ |
| `uvicorn` | 0.49.x | ✓ |

No critical CVEs identified in pinned versions.

---

## Phase 2 — Frontend Audit (TypeScript)

### 2.1 Type Safety — `any` Leaks

Three files cast Supabase join responses to `any`, losing the benefits of the generated `Database` types:

- [useFeed.ts](/Users/lfresco/beer_project/frontend/src/hooks/useFeed.ts) lines 36, 64, 73, 81 — the full join result typed as `any`
- [useStats.ts](/Users/lfresco/beer_project/frontend/src/hooks/useStats.ts) lines 118–138 — leaderboard join rows typed as `any`  
- [PublicProfilePage.tsx](/Users/lfresco/beer_project/frontend/src/pages/PublicProfilePage.tsx) lines 80–125 — identical `any` cast to `useFeed`'s

The root cause: `@supabase/supabase-js` doesn't infer the full joined shape when using string `select()` with nested relations — the inferred type is `any[]`. The fix is to pass `Database` as the generic to `createClient` in [supabase.ts](/Users/lfresco/beer_project/frontend/src/lib/supabase.ts) and use typed `.from<T>()` calls, or define an explicit interface for the join result and cast to it.

### 2.2 State Management & Data-Fetching

- React Query is used throughout with appropriate `staleTime` and `gcTime`. ✓  
- **Issue (#9):** `useStats` leaderboard query (`queryFn` in `useStats.ts` line 104) fetches **all profiles** with all their `beer_entries` in one call — no `limit()`. With even 50 users and 200 entries each that's 10,000 rows + Supabase egress. Add a server-side RPC or add `.limit(20)` on profiles and pre-filter entries by date range server-side.  
- Feed correctly limits to 30 entries and uses `staleTime: 2m`. ✓  
- `useFriends` makes two parallel Supabase queries for accepted requests, then a third to fetch profiles — 3 round trips that could be collapsed into one join query.  
- `authInitialized` is a module-level boolean (#14) — works in production but breaks in React Fast Refresh (HMR) during dev: the flag persists across hot reloads, causing auth to never re-initialise. Move it into a React `useRef` or a Zustand flag.

### 2.3 Client-Side Supabase Usage

- Anon key is used correctly — only for authenticated user operations guarded by RLS. ✓  
- `uploadPhoto` in [storage.ts](/Users/lfresco/beer_project/frontend/src/lib/storage.ts) calls `supabase.storage.from('beer-images').upload(...)` directly from the client. This is fine **only if** the storage bucket RLS policies are in place. The schema.sql storage policies are **commented out** (lines 551–562) — see §RLS below.  
- The `beer-images` bucket is configured as private (`public: false` in the comment) — correct. Signed URLs are used for reading. ✓  
- No service_role key anywhere in frontend code. ✓

### 2.4 Accessibility

- Forms use `<label>` with correct text content, but the native `<input>` elements in `BeerEntryForm` (name, brewery, ABV, city, place search) are not associated via `htmlFor`/`id` — the label is a sibling `<label>` with no `for` attribute, so screen readers won't associate them.
- The place-search combobox (`<input>` + result `<div>` with `<button>` children) has no `role="combobox"`, no `aria-expanded`, and no `aria-controls` — not accessible for keyboard/screen-reader users.
- The star rating widget (`StarRating` component) — not audited in detail but should have `role="radiogroup"` with individual `role="radio"` elements.
- The edit modal uses a native `<dialog>` element — correct and accessible. Focus management on modal open should call `dialog.showModal()` (it does) which correctly traps focus. ✓
- Error messages are rendered as `<span>` / `<p>` adjacent to inputs but have no `role="alert"` or `aria-live` — won't be announced by screen readers.

### 2.5 Performance

- Bundle size not measured, but dependencies are lean (no moment.js, no lodash). ✓  
- `beerBrands` query in `BeerEntryForm` fetches up to 500 rows on mount with `staleTime: 10m` — reasonable, but loading 500 brand names into a `<datalist>` is heavy. The backend `/catalog/brands?q=` search endpoint exists but isn't used here.  
- The leaderboard fetches unbounded data (see #9 above).  
- `useFeed`, `useDeleteEntry`, `useUpdateEntry`, `useToggleLike`, `useAddComment` each call `qc.invalidateQueries({ queryKey: ['feed'] })` on success, which re-fetches the full 30-entry feed. Consider optimistic updates for likes/comments to avoid the full refetch.

### 2.6 XSS / Injection

- No `dangerouslySetInnerHTML` anywhere in the codebase. ✓  
- User-supplied text (beer names, notes, comments, bio, display name) is rendered through React's JSX — automatically escaped. ✓  
- `avatar_url` is passed directly into `<img src={profile.avatar_url}>` — in a browser with a strict CSP this is low-risk; without CSP a crafted `javascript:` URL could execute code in older browsers. The Supabase-hosted avatars are URLs, not data URIs, so real-world risk is low. Add `referrerPolicy="no-referrer"` to avatar `<img>` tags.
- Nominatim place names are rendered as text content inside buttons — no injection risk. ✓

---

## Phase 3 — Supabase RLS Review

### 3.1 `beer_entries` — Visibility Scope

All authenticated users can read all entries (`entries_read: USING (true)`). The comment says "closed group" implying a trust perimeter at the sign-up allowlist level. This is intentional for this app but means any registered user can read every other user's beer history regardless of friendship. Consider whether this is the desired product behaviour — if you want a friend-graph-scoped feed, the `entries_read` policy should use `same_group()`.

### 3.2 `profiles` — INSERT policy missing `TO authenticated`

```sql
-- Current (missing role guard):
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
```

Without `TO authenticated`, the anon role could theoretically insert a profile if `auth.uid()` returns non-null. Add `TO authenticated`.

### 3.3 `friend_requests_delete` — Over-broad recipient delete

```sql
USING (
  (requester_id = auth.uid() AND status = 'pending')
  OR (recipient_id = auth.uid() AND status IN ('pending', 'rejected'))
);
```

The recipient can delete rejected requests. This may be intentional for "cleanup", but it also means the recipient can erase the record that a request ever existed, preventing the requester from seeing their own rejected request. If that's undesired, restrict to `status = 'pending'` for the recipient too.

### 3.4 Storage Bucket — **HIGH (#6)**

The `beer-images` storage RLS policies are commented out in `schema.sql` (lines 551–562):

```sql
-- Storage RLS:
-- CREATE POLICY "beer_images_read" ON storage.objects FOR SELECT
--   USING (bucket_id = 'beer-images' AND auth.role() = 'authenticated');
-- ...
```

If the bucket was created without these policies in the Supabase dashboard, **the bucket has no RLS** and all objects may be world-readable or world-writable depending on bucket public settings. Verify in the Supabase dashboard → Storage → `beer-images` → Policies. The SQL to apply (uncomment and run):

```sql
-- Apply in Supabase SQL Editor:

CREATE POLICY "beer_images_read" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'beer-images');

CREATE POLICY "beer_images_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'beer-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

CREATE POLICY "beer_images_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'beer-images'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );
```

The path convention is `beer_photos/{user_id}/{entry_id}/{timestamp}.ext` so `[2]` (1-indexed) correctly extracts `user_id`. ✓

---

## Fixes

See the generated files added to this repo:

- [`backend/app/supabase_client.py`](./) — dual client (service_role + user-scoped)
- [`supabase/storage_policies.sql`](./supabase/storage_policies.sql) — storage bucket RLS
- [`supabase/rls_fixes.sql`](./supabase/rls_fixes.sql) — patched table-level RLS policies
- [`LOCAL_DEV.md`](./LOCAL_DEV.md) — local dev setup instructions

### Immediate actions required

1. **Rotate the Supabase anon key** — it is in git history (`0bb5a72`). Go to Supabase Dashboard → Project Settings → API → Regenerate anon key.
2. **Rotate the service_role key** if `backend/.env` (also committed) contained the real key.
3. **Remove the committed .env files from git history** using `git filter-repo` or BFG Repo Cleaner.
4. **Apply the storage bucket RLS policies** (`supabase/storage_policies.sql`).
5. **Set a strong `ADMIN_SECRET`** in the Render dashboard (not `change-me`).
