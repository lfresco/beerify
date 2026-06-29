# BeerLog 🍺

Social beer-tracking app for friends. Log beers, post photos, react, and see stats.

**Frontend:** React + TypeScript + Vite → GitHub Pages  
**Backend:** FastAPI → Render  
**Database/Auth/Storage:** Supabase

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Database → SQL Editor** and run `supabase/schema.sql`
3. Go to **Storage** and create a bucket called `beer-images` (private)
4. Run the Storage RLS policies from the comments at the bottom of `schema.sql`
5. Enable **Google** provider in **Authentication → Providers**
6. Set the **Site URL** and **Redirect URLs** to your GitHub Pages URL: `https://<username>.github.io/beer_project`

### 2. Frontend (local dev)

```bash
cd frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run dev
```

### 3. Backend (local dev)

```bash
# From repo root
cp backend/.env.example backend/.env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ADMIN_SECRET
poetry install
cd backend
poetry run uvicorn app.main:app --reload
```

### 4. Deploy Frontend to GitHub Pages

Add these **Repository Secrets** in GitHub (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | From Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | From Supabase → Settings → API |
| `VITE_API_URL` | Your Render service URL |

Push to `main` — GitHub Actions builds and deploys automatically to `gh-pages` branch.  
Enable **Pages** in repo Settings → Pages → Source: `gh-pages` branch, `/ (root)`.

### 5. Deploy Backend to Render

1. Create a **Web Service** on [render.com](https://render.com)
2. Root directory: `backend`
3. Build command: `pip install poetry && poetry install --no-dev`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `backend/.env.example`

### 6. Seed Beer Catalog

After backend is live, trigger the ingestion endpoint once:

```bash
curl -X POST https://<your-render-url>/catalog/ingest \
  -H "X-Admin-Key: <your-ADMIN_SECRET>"
```

This loads ~38 standard beer styles and up to 2000 brands from Open Beer DB.

---

## Project Structure

```
beer_project/
├── frontend/          React app (GitHub Pages)
│   ├── src/
│   │   ├── components/
│   │   │   ├── beer/       BeerEntryForm, PhotoDropzone
│   │   │   ├── feed/       FeedCard
│   │   │   ├── stats/      StatsPanel (Recharts)
│   │   │   └── ui/         Button, Card, Input, NavBar, StarRating
│   │   ├── hooks/          useAuth, useFeed, useStats
│   │   ├── lib/            supabase, api, storage
│   │   ├── pages/          Feed, Stats, Profile, Login, Invite
│   │   ├── store/          Zustand auth store
│   │   └── types/          Database types (re-generate with Supabase CLI)
│   └── vite.config.ts
├── backend/           FastAPI service (Render)
│   └── app/
│       ├── main.py
│       ├── auth.py         JWT verification middleware
│       ├── config.py
│       ├── supabase_client.py
│       └── routers/
│           ├── invites.py  Create/accept invite links
│           └── catalog.py  Beer styles/brands CRUD + ingestion
├── supabase/
│   └── schema.sql          Full schema + RLS policies
└── .github/workflows/
    └── deploy.yml          GitHub Pages CI/CD
```

## Regenerate Database Types

After schema changes, update TypeScript types:

```bash
npx supabase gen types typescript \
  --project-id <your-supabase-project-id> \
  > frontend/src/types/database.ts
```

Then re-enable the typed client in `frontend/src/lib/supabase.ts`.
