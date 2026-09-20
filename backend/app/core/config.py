from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str
    supabase_url: str
    # Só necessária para Storage (fotos) e API admin (seed).
    supabase_service_role_key: str | None = None
    # Só para projetos que ainda usam a chave legada HS256. Com JWKS não é usada.
    supabase_jwt_secret: str | None = None
    # Só para o seed e os testes (nunca usadas pela API).
    seed_password: str | None = None
    supabase_anon_key: str | None = None
    # Separadas por vírgula.
    cors_origins: str = "http://localhost:5173"

    @field_validator("database_url")
    @classmethod
    def use_psycopg3_driver(cls, value: str) -> str:
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @field_validator("supabase_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def auth_issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.auth_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
