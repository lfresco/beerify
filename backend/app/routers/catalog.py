"""
Beer catalog ingestion router.
Loads beer styles and brands from Open Beer DB / public datasets.
Protected admin endpoint — only the service-level admin key triggers ingestion.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query

from app.config import settings
from app.supabase_client import get_supabase

router = APIRouter(prefix="/catalog", tags=["catalog"])

OPENBEERDB_BEERS = "https://openbeerdb.com/files/openbeerdb_csv.zip"


def _require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    """Simple static admin key guard for internal endpoints."""
    expected = settings.admin_secret
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/styles")
async def list_styles():
    """Public: return all beer styles for frontend autocomplete."""
    sb = get_supabase()
    result = sb.table("beer_styles").select("id, name, category").order("name").execute()
    return result.data


@router.get("/brands")
async def list_brands(q: str = "", limit: int = Query(default=50, ge=1, le=200)):
    """Public: search beer brands by name for autocomplete."""
    sb = get_supabase()
    query = sb.table("beer_brands").select("id, name, brewery, style_id, abv").limit(limit)
    if q:
        query = query.ilike("name", f"%{q}%")
    result = query.order("name").execute()
    return result.data


@router.post("/ingest", dependencies=[Depends(_require_admin)])
async def ingest_catalog():
    """
    Admin-only: load beer styles and brands from Open Beer DB CSV dataset.
    Idempotent — upserts on name conflict.
    """
    sb = get_supabase()

    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
        # Styles seed (hardcoded canonical list — open beer DB categories)
        styles = [
            {"name": "IPA", "category": "Ale"},
            {"name": "Double IPA", "category": "Ale"},
            {"name": "Session IPA", "category": "Ale"},
            {"name": "Pale Ale", "category": "Ale"},
            {"name": "Amber Ale", "category": "Ale"},
            {"name": "Stout", "category": "Ale"},
            {"name": "Imperial Stout", "category": "Ale"},
            {"name": "Porter", "category": "Ale"},
            {"name": "Wheat Beer", "category": "Ale"},
            {"name": "Hefeweizen", "category": "Ale"},
            {"name": "Saison", "category": "Ale"},
            {"name": "Belgian Tripel", "category": "Ale"},
            {"name": "Belgian Dubbel", "category": "Ale"},
            {"name": "Blonde Ale", "category": "Ale"},
            {"name": "Brown Ale", "category": "Ale"},
            {"name": "Lager", "category": "Lager"},
            {"name": "Pilsner", "category": "Lager"},
            {"name": "Helles", "category": "Lager"},
            {"name": "Märzen / Oktoberfest", "category": "Lager"},
            {"name": "Bock", "category": "Lager"},
            {"name": "Doppelbock", "category": "Lager"},
            {"name": "Dunkel", "category": "Lager"},
            {"name": "Kellerbier", "category": "Lager"},
            {"name": "Sour / Lambic", "category": "Sour"},
            {"name": "Gueuze", "category": "Sour"},
            {"name": "Fruit Beer", "category": "Specialty"},
            {"name": "Radler / Shandy", "category": "Specialty"},
            {"name": "Barleywine", "category": "Ale"},
            {"name": "Gose", "category": "Sour"},
            {"name": "Kölsch", "category": "Ale"},
            {"name": "Altbier", "category": "Ale"},
            {"name": "Cream Ale", "category": "Ale"},
            {"name": "Milk Stout", "category": "Ale"},
            {"name": "Oatmeal Stout", "category": "Ale"},
            {"name": "Red Ale", "category": "Ale"},
            {"name": "Scotch Ale", "category": "Ale"},
            {"name": "Trappist", "category": "Ale"},
            {"name": "Witbier", "category": "Ale"},
        ]

        # Upsert styles
        sb.table("beer_styles").upsert(styles, on_conflict="name").execute()

        # Try to fetch Open Beer DB data
        brands_ingested = 0
        try:
            import zipfile, io, csv

            resp = await client.get(OPENBEERDB_BEERS)
            resp.raise_for_status()
            z = zipfile.ZipFile(io.BytesIO(resp.content))
            beers_csv = next((n for n in z.namelist() if "beers" in n.lower() and n.endswith(".csv")), None)
            if beers_csv:
                rows = list(csv.DictReader(io.TextIOWrapper(z.open(beers_csv), encoding="utf-8", errors="replace")))
                brands = []
                for row in rows[:2000]:  # cap at 2000 for first ingest
                    name = (row.get("name") or "").strip()
                    if not name or name.lower() == "name":
                        continue
                    abv_raw = (row.get("abv") or "").strip()
                    try:
                        abv = float(abv_raw) if abv_raw else None
                    except ValueError:
                        abv = None
                    brands.append({
                        "name": name,
                        "brewery": (row.get("brewery_name") or row.get("brewery") or "").strip() or None,
                        "abv": abv,
                    })
                if brands:
                    seen = set()
                    unique_brands = []
                    for b in brands:
                        key = b["name"].lower()
                        if key in seen:
                            continue
                        seen.add(key)
                        unique_brands.append(b)
                    sb.table("beer_brands").upsert(unique_brands, on_conflict="name").execute()
                    brands_ingested = len(unique_brands)
        except Exception as e:
            return {"status": "partial", "styles": len(styles), "brands": 0, "error": str(e)}

        return {"status": "ok", "styles": len(styles), "brands": brands_ingested}
