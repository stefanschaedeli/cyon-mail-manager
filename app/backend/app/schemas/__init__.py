from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# ── User schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    role: str = "customer"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("admin", "customer"):
            raise ValueError("role must be 'admin' or 'customer'")
        return v


class UserUpdate(BaseModel):
    email: str | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ── Domain schemas ────────────────────────────────────────────────────────────

class DomainCreate(BaseModel):
    name: str
    user_id: int | None = None
    max_emails: int = 0
    max_forwards: int = 0


class DomainUpdate(BaseModel):
    user_id: int | None = None
    max_emails: int | None = None
    max_forwards: int | None = None


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    user_id: int | None
    max_emails: int
    max_forwards: int
    created_at: datetime


# ── Email account schemas ─────────────────────────────────────────────────────

class EmailCreate(BaseModel):
    local_part: str
    password: str
    quota_mb: int = 0


class EmailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    domain_id: int
    quota_mb: int
    synced: bool
    created_at: datetime


# ── Email forward schemas ─────────────────────────────────────────────────────

class ForwardCreate(BaseModel):
    source_local: str
    destination: str


class ForwardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    destination: str
    domain_id: int
    synced: bool
    created_at: datetime


# ── Audit schemas ─────────────────────────────────────────────────────────────

class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    target: str
    detail: str | None
    created_at: datetime


# ── Auth schemas ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user: UserOut


# ── Domain import schemas ─────────────────────────────────────────────────────

class DomainImportRequest(BaseModel):
    domains: list[str]


# ── Health schemas ────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    db_ok: bool
    ssh_ok: bool


# ── Import result schema ──────────────────────────────────────────────────────

class ImportResult(BaseModel):
    imported: int
