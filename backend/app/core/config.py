"""Application settings loaded from environment / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
