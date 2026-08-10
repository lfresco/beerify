from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlsplit


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str  # Server-side only — never exposed to frontend
    supabase_jwt_secret: str        # From Supabase project settings → API → JWT Secret
    admin_secret: str = "change-me"
    frontend_origin: str = "https://lfresco.github.io"
    frontend_origins: str | None = None
    environment: str = "production"

    @staticmethod
    def _normalize_origin(origin: str) -> str:
        raw = origin.strip().rstrip("/")
        if not raw:
            return raw

        parts = urlsplit(raw)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"

        return raw

    def allowed_origins(self) -> list[str]:
        candidates = [self.frontend_origin]
        if self.frontend_origins:
            candidates = [origin for origin in self.frontend_origins.split(",") if origin.strip()]

        normalized: list[str] = []
        for origin in candidates:
            parsed = self._normalize_origin(origin)
            if parsed and parsed not in normalized:
                normalized.append(parsed)

        return normalized

    def jwt_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
