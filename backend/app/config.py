from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str  # Server-side only — never exposed to frontend
    supabase_jwt_secret: str        # From Supabase project settings → API → JWT Secret
    frontend_origin: str = "https://lfresco.github.io"
    environment: str = "production"


settings = Settings()
