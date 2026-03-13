import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

from dotenv import load_dotenv
load_dotenv()


class Settings(BaseSettings):
    # Couchbase settings
    COUCHBASE_CONNECT_ENDPOINT: str = os.getenv("COUCHBASE_CONNECT_ENDPOINT")
    COUCHBASE_PASSWORD: str = os.getenv("COUCHBASE_PASSWORD")
    COUCHBASE_BUCKET: str = os.getenv("COUCHBASE_BUCKET")
    COUCHBASE_USER: str = os.getenv("COUCHBASE_USERNAME")
    COUCHBASE_SCOPE: Optional[str] = os.getenv("COUCHBASE_SCOPE")


    # Connection settings
    COUCHBASE_CONNECTION_TIMEOUT: int = Field(
        default=10,
        description="Connection timeout in seconds",
        ge=1,
        le=60,
        examples=[10, 20, 30],
        json_schema_extra={"env": "COUCHBASE_CONNECTION_TIMEOUT"}
    )

    COUCHBASE_QUERY_TIMEOUT: int = Field(
        default=30,
        description="Query timeout in seconds",
        ge=5,
        le=120,
        examples=[30, 60, 90],
        json_schema_extra={"env": "COUCHBASE_QUERY_TIMEOUT"}
    )

    COUCHBASE_CONNECTION_POOL_SIZE: int = Field(
        default=5,
        description="Connection pool size",
        ge=1,
        le=50,
        examples=[5, 10, 20],
        json_schema_extra={"env": "COUCHBASE_CONNECTION_POOL_SIZE"}
    )

    COUCHBASE_ENABLE_TLS: bool = Field(
        default=True,
        description="Enable TLS/SSL connection",
        examples=[True, False],
        json_schema_extra={"env": "COUCHBASE_ENABLE_TLS"}
    )

    # FastAPI settings
    APP_NAME: str = Field(
        default="FastAPI Couchbase App",
        description="Application name",
        min_length=3,
        max_length=100,
        examples=["FastAPI Couchbase App"],
        json_schema_extra={"env": "APP_NAME"}
    )

    DEBUG: bool = Field(
        default=False,
        description="Debug mode",
        examples=[True, False],
        json_schema_extra={"env": "DEBUG"}
    )

    API_V1_PREFIX: str = Field(
        default="/v1",
        description="API version prefix",
        pattern="^/v[0-9]+$",
        examples=["/v1"],
        json_schema_extra={"env": "API_V1_PREFIX"}
    )

    # Logging settings
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level",
        pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$",
        examples=["INFO", "DEBUG"],
        json_schema_extra={"env": "LOG_LEVEL"}
    )

    # CORS settings
    CORS_ORIGINS: list[str] = Field(
        default=["*"],
        description="CORS allowed origins",
        examples=[["*"], ["http://localhost:3000"]],
        json_schema_extra={"env": "CORS_ORIGINS"}
    )

    CORS_ALLOW_CREDENTIALS: bool = Field(
        default=True,
        description="CORS allow credentials",
        examples=[True, False],
        json_schema_extra={"env": "CORS_ALLOW_CREDENTIALS"}
    )

    CORS_ALLOW_METHODS: list[str] = Field(
        default=["*"],
        description="CORS allowed methods",
        examples=[["*"], ["GET", "POST"]],
        json_schema_extra={"env": "CORS_ALLOW_METHODS"}
    )

    CORS_ALLOW_HEADERS: list[str] = Field(
        default=["*"],
        description="CORS allowed headers",
        examples=[["*"], ["Content-Type", "Authorization"]],
        json_schema_extra={"env": "CORS_ALLOW_HEADERS"}
    )

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = Field(
        default=False,
        description="Enable rate limiting",
        examples=[True, False],
        json_schema_extra={"env": "RATE_LIMIT_ENABLED"}
    )

    RATE_LIMIT_REQUESTS: int = Field(
        default=100,
        description="Number of requests allowed per window",
        ge=1,
        le=1000,
        examples=[100, 200, 500],
        json_schema_extra={"env": "RATE_LIMIT_REQUESTS"}
    )

    RATE_LIMIT_WINDOW: int = Field(
        default=60,
        description="Time window in seconds",
        ge=1,
        le=3600,
        examples=[60, 120, 300],
        json_schema_extra={"env": "RATE_LIMIT_WINDOW"}
    )

    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    # KAFKA_TOPIC_PROMPT: str = os.getenv("KAFKA_TOPIC_PROMPT", "topic")
    KAFKA_PRODUCER_CLIENT_ID: str = os.getenv("KAFKA_PRODUCER_CLIENT_ID", "producer")

    # ── Schema Registry ───────────────────────────────────────────────────────────
    SCHEMA_REGISTRY_URL: str = os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8080")
    KAFKA_TOPIC_PROMPT: str = "user-prompts"

    # Consumer settings
    KAFKA_CONSUMER_ENABLED: bool = True
    KAFKA_CONSUMER_GROUP_ID: str = "fastapi-consumer-group"

    # Keycloak settings
    KEYCLOAK_URL: str = Field(
        default="http://localhost:8092",
        description="Keycloak base URL",
        examples=["http://localhost:8092"],
        json_schema_extra={"env": "KEYCLOAK_URL"}
    )

    KEYCLOAK_REALM: str = Field(
        default="master",
        description="Keycloak realm name",
        examples=["master", "myrealm"],
        json_schema_extra={"env": "KEYCLOAK_REALM"}
    )

    KEYCLOAK_CLIENT_ID: str = Field(
        default="multiagents-client",
        description="Keycloak client ID",
        examples=["multiagents-client"],
        json_schema_extra={"env": "KEYCLOAK_CLIENT_ID"}
    )

    KEYCLOAK_CLIENT_SECRET: str = Field(
        default="",
        description="Keycloak client secret",
        examples=["my-client-secret"],
        json_schema_extra={"env": "KEYCLOAK_CLIENT_SECRET"}
    )

    KEYCLOAK_ALGORITHMS: list[str] = Field(
        default=["RS256"],
        description="JWT signing algorithms used by Keycloak",
        examples=[["RS256"]],
        json_schema_extra={"env": "KEYCLOAK_ALGORITHMS"}
    )

    # Keycloak Admin credentials (used by user-sync service)
    # The client must have the "view-users" role (realm-management) or be "admin-cli".
    KEYCLOAK_ADMIN_CLIENT_ID: str = Field(
        default="admin-cli",
        description="Keycloak client ID with admin/view-users permissions",
        examples=["admin-cli", "multiagents-client"],
        json_schema_extra={"env": "KEYCLOAK_ADMIN_CLIENT_ID"}
    )

    KEYCLOAK_ADMIN_CLIENT_SECRET: str = Field(
        default="",
        description="Secret for the Keycloak admin client (leave empty for admin-cli with password grant)",
        examples=["my-admin-secret"],
        json_schema_extra={"env": "KEYCLOAK_ADMIN_CLIENT_SECRET"}
    )

    # Used only when KEYCLOAK_ADMIN_CLIENT_ID == "admin-cli" (password grant)
    KEYCLOAK_ADMIN_USERNAME: str = Field(
        default="admin",
        description="Keycloak admin username (for password grant)",
        examples=["admin"],
        json_schema_extra={"env": "KEYCLOAK_ADMIN_USERNAME"}
    )

    KEYCLOAK_ADMIN_PASSWORD: str = Field(
        default="",
        description="Keycloak admin password (for password grant)",
        examples=["admin"],
        json_schema_extra={"env": "KEYCLOAK_ADMIN_PASSWORD"}
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        validate_default = True
        extra = "ignore"  # Bỏ qua các field không được định nghĩa


# Tạo instance settings
settings = Settings()

