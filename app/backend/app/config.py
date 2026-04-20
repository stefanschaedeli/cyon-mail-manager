from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    admin_username: str = "admin"
    admin_password: str
    admin_email: str = "admin@example.ch"

    database_url: str = "sqlite:///./data/app.db"

    cyon_ssh_host: str
    cyon_ssh_port: int = 22
    cyon_ssh_user: str
    cyon_ssh_key_path: str = "/data/ssh/id_ed25519"

    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
