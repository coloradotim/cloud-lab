from dataclasses import dataclass
from functools import lru_cache
from os import getenv


@dataclass(frozen=True)
class Settings:
    app_name: str = "Cloud Lab API"
    app_version: str = "0.1.0"
    environment: str = "local"
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_name=getenv("CLOUD_LAB_APP_NAME", Settings.app_name),
        app_version=getenv("CLOUD_LAB_APP_VERSION", Settings.app_version),
        environment=getenv("CLOUD_LAB_ENVIRONMENT", Settings.environment),
    )
