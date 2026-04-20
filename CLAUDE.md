# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Self-hosted multi-tenant web app for managing email addresses and forwards on cyon.ch hosting via SSH + cPanel UAPI. Admin assigns domains to customers; customers manage email accounts and forwards for their domains only. Runs as a single Docker container on TrueNAS SCALE.

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.0 + Alembic |
| Database | SQLite (`/data/app.db`) |
| Auth | JWT (python-jose) + bcrypt |
| cyon bridge | Paramiko SSH → cPanel UAPI |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS 3 |
| Container | Single Docker (multi-stage), docker-compose |

FastAPI serves both `/api/*` (handlers) and `/*` (React SPA static files) — one container, one port (8000).

## Architecture

```
Browser → FastAPI ┬─ /api/*  → route handlers → SQLAlchemy → SQLite
                  └─ /*      → React SPA (static)
                              └─ CyonService → SSH → s075.cyon.net
Volume /data: app.db + ssh/id_ed25519
```

## Context Map

For detailed guidance, read the CLAUDE.md closest to the code you're working on:

| Area | File |
|------|------|
| Backend (commands, conventions, env vars) | [`app/backend/CLAUDE.md`](app/backend/CLAUDE.md) |
| Data models (all 5 tables) | [`app/backend/app/models/CLAUDE.md`](app/backend/app/models/CLAUDE.md) |
| API endpoints + auth/permission rules | [`app/backend/app/api/CLAUDE.md`](app/backend/app/api/CLAUDE.md) |
| cyon SSH/UAPI integration + sync strategy | [`app/backend/app/services/CLAUDE.md`](app/backend/app/services/CLAUDE.md) |
| Frontend (pages, auth flow, conventions) | [`app/frontend/CLAUDE.md`](app/frontend/CLAUDE.md) |
| Docs | [`docs/CLAUDE.md`](docs/CLAUDE.md) |

## Docker

Multi-stage: `node:20-alpine` builds frontend → `python:3.12-slim` serves everything.
Entrypoint: `alembic upgrade head` → `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
docker-compose: port 8080→8000, volume `./data:/data`, env_file `.env`.
First run: auto-creates admin from env vars if no users exist.

## Roles & Permissions

| Action | admin | customer |
|--------|-------|----------|
| Manage customer accounts / assign domains | ✓ | |
| View full audit log / trigger sync | ✓ | |
| List own domains | ✓ | ✓ |
| Create/delete emails + forwards on own domains | ✓ | ✓ |

Domain access is enforced **server-side** on every request (`deps.py::verify_domain_access`).

## Versioning

`app/version.txt` is the single source of truth for the app version. It is read at frontend build time by Vite and displayed in the sidebar.

**Before every commit**, bump the patch version in `app/version.txt` (e.g. `0.1.0` → `0.1.1`) and include the updated file in the commit.

### Commit message format

Use a short one-line subject, then a bullet-point body listing every change:

```
v0.1.1 — <short summary of the session's changes>

- <change 1>
- <change 2>
- <change 3>
```

Keep bullets short and user-facing (what changed, not how). No filler phrases like "updated" or "refactored" — just state the change directly.

## Build Order

1. Backend models + Alembic migration
2. Auth (login, JWT, me)
3. Admin CRUD (users, domains)
4. CyonService (SSH + UAPI)
5. Customer email/forward endpoints
6. Sync service
7. Frontend: login → customer dashboard → domain detail
8. Frontend: admin pages
9. Dockerfile + docker-compose
