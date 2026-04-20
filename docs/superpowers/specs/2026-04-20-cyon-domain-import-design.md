# Cyon Domain Import — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

## Summary

Admin-only feature to discover domains configured on the cyon hosting account and bulk-import them into the app. Imported domains start unassigned; admin maps them to customers via the existing domain edit flow.

## Scope

- **In:** main domain + addon domains from cyon (not subdomains)
- **Out:** auto-assignment to users, quota pre-configuration, subdomain import

---

## Backend

### CyonService — `list_domains() -> list[str]`

New method on `CyonService` (`app/services/cyon.py`):

```python
def list_domains(self) -> list[str]:
    ...
```

- Runs `uapi --output=json DomainInfo domains_data`
- Extracts `result.data.main_domain.domain` + all `result.data.addon_domains[].domain`
- Returns sorted `list[str]` of domain name strings
- Raises `CyonError` on UAPI failure (`result.status != 1`)
- Blocking — callers must wrap with `asyncio.to_thread()`

### API Endpoints (added to `app/api/admin.py`)

**`GET /api/admin/domains/cyon`** — list importable domains  
- Requires `require_admin`  
- Calls `CyonService.list_domains()` via `asyncio.to_thread()`  
- Loads existing domain names from DB  
- Returns only domains on cyon but NOT in DB  
- Response: `list[str]`  
- On SSH/UAPI failure: 502 via existing `CyonError` handler  

**`POST /api/admin/domains/import`** — bulk import selected domains  
- Requires `require_admin`  
- Body: `{ "domains": ["example.ch", "foo.ch"] }`  
- For each domain: insert into DB if not already present (`user_id=null`, `max_emails=0`, `max_forwards=0`)  
- Skips duplicates silently (idempotent)  
- Logs each created domain to audit log: `action="domain_import", target=domain_name`  
- Response: `list[DomainOut]` — only the newly created records  

### Schemas (added to `app/schemas/__init__.py`)

```python
class DomainImportRequest(BaseModel):
    domains: list[str]
```

---

## Frontend

### Admin Domains page (`src/pages/admin/DomainsPage.tsx`)

Add **"Import from cyon"** button next to existing "Add Domain" button.

**Flow:**

1. Admin clicks "Import from cyon"
2. Button shows spinner; calls `GET /api/admin/domains/cyon`
3. **If no new domains:** toast "All cyon domains are already imported" — no dialog
4. **If new domains found:** opens `ImportDomainsDialog`

**`ImportDomainsDialog`:**

- Lists each new domain with a checkbox (all pre-checked)
- Shows count: "X new domains found on cyon"
- "Import N domains" confirm button (N = checked count, disabled if none checked)
- "Cancel" button
- On confirm: calls `POST /api/admin/domains/import` with checked domains
- On success: closes dialog, invalidates `["admin", "domains"]` query, toast "N domains imported"
- On error: toast "Import failed"

### API client (`src/lib/api.ts`)

Two new functions:

```ts
fetchCyonDomains(): Promise<string[]>
importDomains(domains: string[]): Promise<Domain[]>
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| SSH unreachable | 502 from existing CyonError handler → toast "Import failed" |
| No new domains | Toast only, no dialog |
| Partial selection (some unchecked) | Only checked domains sent in request |
| Domain added between fetch and import | Skipped silently (idempotent insert) |

---

## Files Changed

| File | Change |
|------|--------|
| `app/backend/app/services/cyon.py` | Add `list_domains()` |
| `app/backend/app/api/admin.py` | Add 2 endpoints |
| `app/backend/app/schemas/__init__.py` | Add `DomainImportRequest` |
| `app/frontend/src/lib/api.ts` | Add 2 API functions |
| `app/frontend/src/pages/admin/DomainsPage.tsx` | Add button + dialog |
