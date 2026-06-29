from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str  # Server-side only — never exposed to frontend
    supabase_jwt_secret: str        # From Supabase project settings → API → JWT Secret
    admin_secret: str = "change-me"
    frontend_origin: str = "https://lfresco.github.io"
    frontend_origins: str | None = None
    environment: str = "production"

    def allowed_origins(self) -> list[str]:
        if self.frontend_origins:
            return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]
        return [self.frontend_origin]

    def jwt_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
