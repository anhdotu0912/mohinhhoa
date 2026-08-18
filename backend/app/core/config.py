"""Application settings loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path
import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env từ cwd, rồi project files. Project `.env` ghi đè User/Machine
# Windows env để key trong repo (vd. DEEPSEEK_API_KEY) luôn thắng khi chạy local.
# Pytest sets PYTEST_RUNNING=1 and hermetic env vars first — do not override those.
_DOTENV_OVERRIDE = os.getenv("PYTEST_RUNNING") != "1"
load_dotenv(override=_DOTENV_OVERRIDE)

_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
_REPO_ROOT = Path(__file__).resolve().parents[3]  # repo root
# Root trước, backend/.env sau (nếu có) — backend thắng khi cả hai tồn tại.
for _env_path in (_REPO_ROOT / ".env", _BACKEND_DIR / ".env"):
    if _env_path.exists():
        load_dotenv(_env_path, override=_DOTENV_OVERRIDE)


class Settings(BaseSettings):
    # LLM — provider: openai | deepseek
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    OPENAI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # Embedding — provider: gemini (default) | local
    EMBEDDING_PROVIDER: str = "gemini"
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    # Comma-separated pool, e.g. key-1,key-2,key-3
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2"
    GEMINI_EMBEDDING_DIMENSION: int = 768

    # Database
    DATABASE_URL: str = "sqlite:///./app.db"

    # Vector Store (ChromaDB)
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # Auth
    JWT_SECRET: str = "change-me-dev-only"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"

    # SMTP — chỉ cần USERNAME + PASSWORD (App Password). Host/port/TLS mặc định Gmail.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    # Demo mode: return contract-shaped mock data for agent features that
    # are not implemented yet (meal plan, interaction check). Disable in prod.
    DEMO_MOCK: bool = True

    # Generation defaults
    DEFAULT_VARIANTS_PER_JOB: int = 3
    DEFAULT_PLAN_DAYS: int = 7

    # Doctor compliance view — low adherence threshold (ADR-008)
    COMPLIANCE_LOW_THRESHOLD_PCT: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
