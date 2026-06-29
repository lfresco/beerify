import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Ensure required settings exist before app import.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("FRONTEND_ORIGINS", "http://localhost:5173,https://example.com")
os.environ.setdefault("ENVIRONMENT", "development")

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_headers_present():
    response = client.get("/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "same-origin"


def test_catalog_limit_validation():
    # Should fail on validation before touching Supabase.
    response = client.get("/catalog/brands", params={"limit": 1000})
    assert response.status_code == 422


def test_invite_preview_token_length_validation():
    response = client.get("/invites/short/preview")
    assert response.status_code == 400


def test_catalog_ingest_requires_admin_header():
    response = client.post("/catalog/ingest")
    assert response.status_code == 403
