# API CLAUDE.md

FastAPI routers. All routes aggregated in `router.py` and included in `main.py`.

## Auth endpoints
```
POST /api/auth/login    { username, password } → { token, user }
GET  /api/auth/me       Bearer → { user }
```

## Admin endpoints (require_admin dependency)
```
GET    /api/admin/users
POST   /api/admin/users       { username, password, email, role }
PUT    /api/admin/users/:id    { email?, is_active? }
DELETE /api/admin/users/:id

GET    /api/admin/domains
POST   /api/admin/domains      { name, user_id, max_emails, max_forwards }
PUT    /api/admin/domains/:id   { user_id?, max_emails?, max_forwards? }
DELETE /api/admin/domains/:id

GET    /api/admin/audit         paginated
POST   /api/admin/sync          triggers full cyon sync
```

## Customer endpoints (verify_domain_access dependency in deps.py)
```
GET    /api/domains                        own domains only
GET    /api/domains/:name/emails
POST   /api/domains/:name/emails           { local_part, password, quota_mb? }
DELETE /api/domains/:name/emails/:address

GET    /api/domains/:name/forwards
POST   /api/domains/:name/forwards         { source_local, destination }
DELETE /api/domains/:name/forwards/:id     id = DB row id
```

## Health
```
GET /api/health  → { status, db_ok, ssh_ok }
```

## Key rule

`deps.py::verify_domain_access` must be used on every email/forward endpoint — it's the
server-side enforcement that a customer only touches their own domains. Never skip it.
