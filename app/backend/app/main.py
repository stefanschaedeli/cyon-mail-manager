from contextlib import asynccontextmanager
from pathlib import Path

import sqlalchemy
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.services.cyon import CyonError

from app.schemas import HealthResponse

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _create_default_admin()
    yield


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


app = FastAPI(title="Cyon Mail Manager", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.router import router  # noqa: E402 — after app creation to avoid circular imports
app.include_router(router)


@app.exception_handler(CyonError)
async def cyon_error_handler(request: Request, exc: CyonError):
    return JSONResponse(status_code=502, content={"detail": f"cyon error: {exc}"})


@app.get("/api/health", response_model=HealthResponse)
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
    return HealthResponse(status="ok", db_ok=db_ok, ssh_ok=False)


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
