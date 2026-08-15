"""Application settings loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env từ cwd và tìm lên các thư mục cha (repo root) để chạy được từ
# cả `backend/` lẫn repo root mà không cần copy .env. Không ghi đè env đã set.
load_dotenv()

_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
_REPO_ROOT = Path(__file__).resolve().parents[3]  # repo root
for _env_path in (_BACKEND_DIR / ".env", _REPO_ROOT / ".env"):
    if _env_path.exists():
        load_dotenv(_env_path, override=False)


class Settings(BaseSettings):
    # LLM — provider: openai | deepseek
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    OPENAI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # Embedding
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"

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

    # Demo mode: return contract-shaped mock data for agent features that
    # are not implemented yet (meal plan, interaction check). Disable in prod.
    DEMO_MOCK: bool = True

    # Generation defaults
    DEFAULT_VARIANTS_PER_JOB: int = 3
    DEFAULT_PLAN_DAYS: int = 7

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
