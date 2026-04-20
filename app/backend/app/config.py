from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    admin_username: str = "admin"
    admin_password: str = "change-me"
    admin_email: str = "admin@example.ch"

    database_url: str = "sqlite:///./data/app.db"

    cyon_ssh_host: str = "s075.cyon.net"
    cyon_ssh_port: int = 22
    cyon_ssh_user: str = "swebdesi"
    cyon_ssh_key_path: str = "/data/ssh/id_ed25519"


settings = Settings()
