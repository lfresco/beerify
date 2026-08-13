# Local Development Setup

Run BeerLog locally against a sandboxed Supabase instance — no production data touched.

## Prerequisites

| Tool | Install |
|------|---------|
| Docker Desktop (running) | https://www.docker.com/products/docker-desktop |
| Supabase CLI | `brew install supabase/tap/supabase` |
| Python ≥ 3.11 + Poetry | `brew install poetry` |
| Node.js ≥ 20 + npm | `brew install node` |

---

## 1. Start local Supabase

```bash
# From the repo root
supabase init        # only needed once — creates supabase/ config
supabase start       # pulls Docker images and starts Postgres + Auth + Storage + Studio
```

After `supabase start` you will see output like:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio: http://127.0.0.1:54323
```

Copy those values — you'll use them in the `.env` files below.

---

## 2. Apply the schema

```bash
# Apply the full schema to the local instance:
supabase db reset
# This runs supabase/migrations/ if any exist, then supabase/seed.sql.

# Or apply the schema manually:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/schema.sql

# Apply storage RLS policies:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/storage_policies.sql

# Apply additional RLS fixes:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/rls_fixes.sql
```

---

## 3. Seed sample data

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/seed.sql
```

The seed script (`supabase/seed.sql`) inserts:
- 3 users in `auth.users` + `allowed_emails` + `profiles`
- 10 beer styles, 15 beer brands
- 20 beer entries spread across the three users
- Some likes, comments, and friend relationships

---

## 4. Configure environment variables

**Backend** — create `backend/.env` (already gitignored):

```ini
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
ADMIN_SECRET=local-dev-admin-secret-changeme
FRONTEND_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```

**Frontend** — create `frontend/.env` (already gitignored):

```ini
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
VITE_API_URL=http://localhost:8000
```

> **Never commit these files.** The `.gitignore` already excludes `.env` and `.env.*`.

---

## 5. Run the backend

```bash
# From repo root
poetry install
poetry run uvicorn app.main:app --reload --app-dir backend
# Starts on http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

---

## 6. Run the frontend dev server

```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:5173
```

---

## 7. Reset the local database

```bash
supabase db reset
# Drops and recreates the local DB, re-runs migrations and seed.sql
```

---

## 8. Stop Supabase

```bash
supabase stop
```

---

## Notes

- Local Supabase Studio (DB browser + auth admin) runs at **http://127.0.0.1:54323**
- The local JWT secret is the fixed string above — all local tokens are signed with it
- To create a test user, use Studio → Authentication → Users → Add user, then add their email to `allowed_emails` via Studio → Table editor
- Storage emulation is included — uploads go to local Docker volumes, not S3
