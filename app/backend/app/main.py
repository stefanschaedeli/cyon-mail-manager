from contextlib import asynccontextmanager
from pathlib import Path

import sqlalchemy
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.services.cyon import CyonError


@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_config()
    _create_default_admin()
    yield


def _validate_config() -> None:
    from app.config import settings

    insecure_keys = {"dev-secret-change-in-production", "change-me-to-a-random-64-char-string", "change-me", ""}
    if settings.secret_key in insecure_keys or len(settings.secret_key) < 32:
        raise RuntimeError(
            "SECRET_KEY is not set or is using a placeholder value. "
            "Generate a secure key with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
        )


def _create_default_admin() -> None:
    from app.config import settings
    from app.core.auth import hash_password
    from app.core.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username=settings.admin_username,
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


app = FastAPI(
    title="Cyon Mail Manager",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.config import settings  # noqa: E402

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

from app.api.router import router  # noqa: E402 — after app creation to avoid circular imports
app.include_router(router)


@app.exception_handler(CyonError)
async def cyon_error_handler(request: Request, exc: CyonError):
    return JSONResponse(status_code=502, content={"detail": "An upstream error occurred"})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Invalid request"})


@app.get("/api/health")
def health():
    from app.core.database import SessionLocal
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(sqlalchemy.text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass
    if not db_ok:
        return JSONResponse(status_code=503, content={"status": "degraded"})
    return JSONResponse(status_code=200, content={"status": "ok"})


# ── React SPA static files ────────────────────────────────────────────────────
# Served last so /api/* routes always win.

_STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

if _STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        file = _STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_STATIC_DIR / "index.html")
