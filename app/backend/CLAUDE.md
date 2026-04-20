# Backend CLAUDE.md

Python 3.12 + FastAPI backend. See also: [API spec](app/CLAUDE.md), [cyon integration](app/services/CLAUDE.md), [data model](app/models/CLAUDE.md).

## Commands

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
pytest tests/test_auth.py::test_login -v
```

## Entry Points

- `app/main.py` — FastAPI app instance, startup hooks (create default admin), mounts React static files at `/*` and API at `/api/*`
- `app/config.py` — pydantic-settings, reads all env vars, single `Settings` instance imported everywhere

## Coding Conventions

- Type hints everywhere
- SQLAlchemy 2.0 style: `Mapped[]` + `mapped_column()`
- Pydantic v2 schemas
- API errors: `{"detail": "message"}` pattern
- `asyncio.to_thread()` for all blocking SSH calls
- All destructive actions written to `audit_log`
- Validate email format server-side with regex before passing to cyon
- Rate limit login: 5 attempts/min/IP (slowapi)

## Environment Variables

```env
SECRET_KEY=random-64-char-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ADMIN_EMAIL=admin@example.ch
DATABASE_URL=sqlite:////data/app.db
CYON_SSH_HOST=s075.cyon.net
CYON_SSH_PORT=22
CYON_SSH_USER=swebdesi
CYON_SSH_KEY_PATH=/data/ssh/id_ed25519
```
