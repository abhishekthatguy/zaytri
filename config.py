"""
Zaytri — Centralized Configuration
Reads all settings from environment variables / .env file.
Ports are the single source of truth — URLs auto-derive when not overridden.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, model_validator
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "Zaytri"
    app_env: str = "development"
    app_debug: bool = True
    log_level: str = "INFO"
    cors_origins: str = ""  # auto-derived from ports if empty

    # ── Service Ports (single source of truth) ───────────────────────────
    backend_port: int = 8000
    frontend_port: int = 3000
    redis_port: int = 6379
    postgres_port: int = 5432
    ollama_port: int = 11434

    # ── Database (PostgreSQL) ────────────────────────────────────────────
    database_url: str = ""
    database_url_sync: str = ""

    # ── Redis ────────────────────────────────────────────────────────────
    redis_url: str = ""
    flush_redis_on_start: bool = False

    # ── Ollama (Local LLM) ──────────────────────────────────────────────
    ollama_host: str = ""
    ollama_model: str = "llama3.2:latest"

    # ── JWT Authentication ──────────────────────────────────────────────
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours

    # ── OAuth — User Login (Google, Facebook, GitHub, Twitter) ──────────
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_facebook_app_id: str = ""
    oauth_facebook_app_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""
    oauth_twitter_client_id: str = ""
    oauth_twitter_client_secret: str = ""

    # ── OAuth — Social Platforms (also used for Connect flows) ──────────
    # LinkedIn
    oauth_linkedin_client_id: str = ""
    oauth_linkedin_client_secret: str = ""
    # Reddit
    oauth_reddit_client_id: str = ""
    oauth_reddit_client_secret: str = ""
    # Medium
    oauth_medium_client_id: str = ""
    oauth_medium_client_secret: str = ""

    # ── WhatsApp Business API (for content approval flow) ────────────────
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "zaytri-whatsapp-verify"
    whatsapp_approval_phone: str = ""  # Phone number to send approval messages to

    # ── Legacy Platform Credentials (deprecated — use OAuth Connect) ────
    # Kept for backward compatibility during migration.
    # These will be removed in a future version.
    instagram_access_token: str = ""
    instagram_business_account_id: str = ""
    instagram_app_secret: str = ""
    facebook_access_token: str = ""
    facebook_page_id: str = ""
    facebook_app_secret: str = ""
    twitter_api_key: str = ""
    twitter_api_secret: str = ""
    twitter_access_token: str = ""
    twitter_access_token_secret: str = ""
    twitter_bearer_token: str = ""
    youtube_api_key: str = ""
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_refresh_token: str = ""

    @model_validator(mode="after")
    def _derive_urls_from_ports(self) -> "Settings":
        """Auto-derive URLs from port variables when not explicitly set."""
        if not self.cors_origins:
            self.cors_origins = (
                f"http://localhost:{self.frontend_port},"
                f"http://localhost:{self.backend_port}"
            )
        if not self.redis_url:
            self.redis_url = f"redis://localhost:{self.redis_port}/0"
        if not self.ollama_host:
            self.ollama_host = f"http://localhost:{self.ollama_port}"
        if not self.database_url:
            self.database_url = (
                f"postgresql+asyncpg://zaytri_user:password@localhost:{self.postgres_port}/zaytri_db"
            )
        if not self.database_url_sync:
            self.database_url_sync = (
                f"postgresql://zaytri_user:password@localhost:{self.postgres_port}/zaytri_db"
            )
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # Legacy compatibility — these check old env vars (will be removed)
    @property
    def is_instagram_configured(self) -> bool:
        return bool(self.instagram_access_token and self.instagram_business_account_id)

    @property
    def is_facebook_configured(self) -> bool:
        return bool(self.facebook_access_token and self.facebook_page_id)

    @property
    def is_twitter_configured(self) -> bool:
        return bool(self.twitter_api_key and self.twitter_api_secret)

    @property
    def is_youtube_configured(self) -> bool:
        return bool(self.youtube_api_key)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


# Singleton instance
settings = Settings()
