"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # OpenClaw Gateway
    openclaw_gateway_url: str = "ws://localhost:18789"
    openclaw_gateway_token: str = ""

    # Server
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8090

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
