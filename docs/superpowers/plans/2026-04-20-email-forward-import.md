# Email & Forward Import (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-only "Load from cyon" buttons to the Domain Detail page that import all emails and forwards currently configured on cyon but not yet in the local DB.

**Architecture:** Two new POST endpoints under `/api/admin/domains/{domain_name}/import-emails` and `/api/admin/domains/{domain_name}/import-forwards` fetch live data from cyon, diff against the DB, insert missing records, and return the count imported. The frontend `DomainDetailPage` reads `user.role` from `useAuth` and shows the import button only to admins; clicking it calls the endpoint and invalidates the relevant query.

**Tech Stack:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (backend); React 18 + TypeScript + TanStack Query + Tailwind CSS (frontend); pytest (tests)

---

## File Map

| File | Change |
|------|--------|
| `app/backend/app/schemas/__init__.py` | Add `ImportResult` response schema |
| `app/backend/app/api/admin.py` | Add `import_emails` and `import_forwards` endpoints |
| `app/backend/tests/test_import.py` | New — unit tests for both endpoints |
| `app/frontend/src/lib/api.ts` | Add `importEmails` and `importForwards` API functions |
| `app/frontend/src/pages/DomainDetailPage.tsx` | Read `user` from `useAuth`, pass `isAdmin` to tab components, add "Load from cyon" button in each tab |

---

## Task 1: Add `ImportResult` schema

**Files:**
- Modify: `app/backend/app/schemas/__init__.py`

- [ ] **Step 1: Add the schema at the bottom of the file, after the existing `HealthResponse` class**

```python
# ── Import result schema ──────────────────────────────────────────────────────

class ImportResult(BaseModel):
    imported: int
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
cd app/backend && python -c "from app.schemas import ImportResult; print(ImportResult(imported=3))"
```

Expected output: `imported=3`

- [ ] **Step 3: Commit**

```bash
git add app/backend/app/schemas/__init__.py
git commit -m "feat: add ImportResult schema for email/forward import endpoints"
```

---

## Task 2: Backend — email import endpoint

**Files:**
- Modify: `app/backend/app/api/admin.py`

The endpoint fetches live emails from cyon for the domain, finds addresses not in the DB, inserts them with `synced=True` and the quota from cyon, and logs each import.

Note: `cyon.list_emails(domain)` returns `[{"email": "user@example.ch", "quota_mb": 250, ...}, ...]`. The domain must already exist in the DB (404 otherwise).

- [ ] **Step 1: Add the import to the top of `admin.py` — add `EmailAccount` to the existing models import**

Current line (around line 9):
```python
from app.models import AuditLog, Domain, User
```

Replace with:
```python
from app.models import AuditLog, Domain, EmailAccount, EmailForward, User
```

- [ ] **Step 2: Add `ImportResult` to the schemas import block in `admin.py`**

Current line (around line 10-19):
```python
from app.schemas import (
    AuditOut,
    DomainCreate,
    DomainImportRequest,
    DomainOut,
    DomainUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)
```

Replace with:
```python
from app.schemas import (
    AuditOut,
    DomainCreate,
    DomainImportRequest,
    DomainOut,
    DomainUpdate,
    ImportResult,
    UserCreate,
    UserOut,
    UserUpdate,
)
```

- [ ] **Step 3: Add the `import_emails` endpoint after the `import_domains` endpoint (after line ~224 in admin.py)**

Add after the closing of the `import_domains` function:

```python
@router.post("/domains/{domain_name}/import-emails", response_model=ImportResult)
async def import_emails(
    domain_name: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    import asyncio
    from app.services.cyon import get_cyon_service

    domain = db.query(Domain).filter(Domain.name == domain_name).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    cyon = get_cyon_service()
    cyon_emails = await asyncio.to_thread(cyon.list_emails, domain_name)

    existing = {
        a.address
        for a in db.query(EmailAccount).filter(EmailAccount.domain_id == domain.id).all()
    }

    count = 0
    for item in cyon_emails:
        if item["email"] in existing:
            continue
        account = EmailAccount(
            address=item["email"],
            domain_id=domain.id,
            quota_mb=item["quota_mb"],
            synced=True,
        )
        db.add(account)
        db.flush()
        log_action(db, admin.id, "import_email", item["email"])
        count += 1

    db.commit()
    return ImportResult(imported=count)
```

- [ ] **Step 4: Verify the backend starts without errors**

```bash
cd app/backend && python -c "from app.api.admin import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add app/backend/app/api/admin.py
git commit -m "feat: add admin import-emails endpoint for domain"
```

---

## Task 3: Backend — forward import endpoint

**Files:**
- Modify: `app/backend/app/api/admin.py`

`cyon.list_forwards(domain)` returns `[{"source": "alias@example.ch", "destination": "target@ext.com"}, ...]`.

- [ ] **Step 1: Add the `import_forwards` endpoint immediately after the `import_emails` endpoint**

```python
@router.post("/domains/{domain_name}/import-forwards", response_model=ImportResult)
async def import_forwards(
    domain_name: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    import asyncio
    from app.services.cyon import get_cyon_service

    domain = db.query(Domain).filter(Domain.name == domain_name).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    cyon = get_cyon_service()
    cyon_forwards = await asyncio.to_thread(cyon.list_forwards, domain_name)

    existing = {
        (f.source, f.destination)
        for f in db.query(EmailForward).filter(EmailForward.domain_id == domain.id).all()
    }

    count = 0
    for item in cyon_forwards:
        if (item["source"], item["destination"]) in existing:
            continue
        forward = EmailForward(
            source=item["source"],
            destination=item["destination"],
            domain_id=domain.id,
            synced=True,
        )
        db.add(forward)
        db.flush()
        log_action(db, admin.id, "import_forward", f"{item['source']} → {item['destination']}")
        count += 1

    db.commit()
    return ImportResult(imported=count)
```

- [ ] **Step 2: Verify the backend parses cleanly**

```bash
cd app/backend && python -c "from app.api.admin import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/backend/app/api/admin.py
git commit -m "feat: add admin import-forwards endpoint for domain"
```

---

## Task 4: Backend tests

**Files:**
- Create: `app/backend/tests/test_import.py`

These tests use an in-memory SQLite DB and mock out the cyon service. Check the existing test file structure for how the test client and DB fixture are set up.

- [ ] **Step 1: Check existing test fixtures**

```bash
ls app/backend/tests/
```

Read one of the existing test files to understand how `client` and `db` fixtures are set up (look for `conftest.py` or inline fixtures using `TestClient` and `get_db` override).

- [ ] **Step 2: Write the failing tests**

Create `app/backend/tests/test_import.py`. Adapt the fixture setup to match what you found in Step 1 (use the same `client`/`db` fixture pattern).

```python
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_admin_token(client: TestClient) -> str:
    """Log in as the seeded admin and return the bearer token."""
    res = client.post("/api/auth/login", json={"username": "admin", "password": "adminpass"})
    assert res.status_code == 200
    return res.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── import-emails ─────────────────────────────────────────────────────────────

def test_import_emails_inserts_missing(client: TestClient, db):
    token = _make_admin_token(client)

    # Create a domain in the DB
    res = client.post(
        "/api/admin/domains",
        json={"name": "example.ch", "max_emails": 0, "max_forwards": 0},
        headers=_auth(token),
    )
    assert res.status_code == 201

    cyon_emails = [
        {"email": "alice@example.ch", "quota_mb": 250, "disk_used_mb": 10.0},
        {"email": "bob@example.ch", "quota_mb": 500, "disk_used_mb": 5.0},
    ]

    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.list_emails.return_value = cyon_emails
        mock_factory.return_value = mock_cyon

        res = client.post(
            "/api/admin/domains/example.ch/import-emails",
            headers=_auth(token),
        )

    assert res.status_code == 200
    assert res.json() == {"imported": 2}

    emails = client.get("/api/domains/example.ch/emails", headers=_auth(token)).json()
    addresses = {e["address"] for e in emails}
    assert "alice@example.ch" in addresses
    assert "bob@example.ch" in addresses


def test_import_emails_skips_existing(client: TestClient, db):
    token = _make_admin_token(client)

    client.post(
        "/api/admin/domains",
        json={"name": "skip.ch", "max_emails": 0, "max_forwards": 0},
        headers=_auth(token),
    )

    # Create alice via the normal flow so she's already in DB
    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.create_email.return_value = {}
        mock_factory.return_value = mock_cyon
        client.post(
            "/api/domains/skip.ch/emails",
            json={"local_part": "alice", "password": "Secret1!"},
            headers=_auth(token),
        )

    cyon_emails = [
        {"email": "alice@skip.ch", "quota_mb": 250, "disk_used_mb": 0.0},
        {"email": "bob@skip.ch", "quota_mb": 100, "disk_used_mb": 0.0},
    ]

    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.list_emails.return_value = cyon_emails
        mock_factory.return_value = mock_cyon

        res = client.post(
            "/api/admin/domains/skip.ch/import-emails",
            headers=_auth(token),
        )

    assert res.status_code == 200
    assert res.json() == {"imported": 1}  # only bob


def test_import_emails_domain_not_found(client: TestClient, db):
    token = _make_admin_token(client)
    res = client.post(
        "/api/admin/domains/notexist.ch/import-emails",
        headers=_auth(token),
    )
    assert res.status_code == 404


# ── import-forwards ───────────────────────────────────────────────────────────

def test_import_forwards_inserts_missing(client: TestClient, db):
    token = _make_admin_token(client)

    client.post(
        "/api/admin/domains",
        json={"name": "fwd.ch", "max_emails": 0, "max_forwards": 0},
        headers=_auth(token),
    )

    cyon_forwards = [
        {"source": "info@fwd.ch", "destination": "owner@gmail.com"},
        {"source": "sales@fwd.ch", "destination": "owner@gmail.com"},
    ]

    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.list_forwards.return_value = cyon_forwards
        mock_factory.return_value = mock_cyon

        res = client.post(
            "/api/admin/domains/fwd.ch/import-forwards",
            headers=_auth(token),
        )

    assert res.status_code == 200
    assert res.json() == {"imported": 2}

    forwards = client.get("/api/domains/fwd.ch/forwards", headers=_auth(token)).json()
    sources = {f["source"] for f in forwards}
    assert "info@fwd.ch" in sources
    assert "sales@fwd.ch" in sources


def test_import_forwards_skips_existing(client: TestClient, db):
    token = _make_admin_token(client)

    client.post(
        "/api/admin/domains",
        json={"name": "fwdskip.ch", "max_emails": 0, "max_forwards": 0},
        headers=_auth(token),
    )

    # Create info forward via normal flow
    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.create_forward.return_value = {}
        mock_factory.return_value = mock_cyon
        client.post(
            "/api/domains/fwdskip.ch/forwards",
            json={"source_local": "info", "destination": "owner@gmail.com"},
            headers=_auth(token),
        )

    cyon_forwards = [
        {"source": "info@fwdskip.ch", "destination": "owner@gmail.com"},
        {"source": "sales@fwdskip.ch", "destination": "owner@gmail.com"},
    ]

    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_cyon = MagicMock()
        mock_cyon.list_forwards.return_value = cyon_forwards
        mock_factory.return_value = mock_cyon

        res = client.post(
            "/api/admin/domains/fwdskip.ch/import-forwards",
            headers=_auth(token),
        )

    assert res.status_code == 200
    assert res.json() == {"imported": 1}  # only sales


def test_import_forwards_domain_not_found(client: TestClient, db):
    token = _make_admin_token(client)
    res = client.post(
        "/api/admin/domains/notexist.ch/import-forwards",
        headers=_auth(token),
    )
    assert res.status_code == 404
```

- [ ] **Step 3: Run tests to verify they fail (endpoints not yet wired — actually they ARE wired from Tasks 2-3, so they should pass)**

```bash
cd app/backend && pytest tests/test_import.py -v
```

All 6 tests should pass. If any fail, read the error carefully — the most likely cause is the fixture setup (conftest). Adapt the import of `client` and `db` to match what's in `conftest.py`.

- [ ] **Step 4: Commit**

```bash
git add app/backend/tests/test_import.py
git commit -m "test: add tests for email and forward import endpoints"
```

---

## Task 5: Frontend API functions

**Files:**
- Modify: `app/frontend/src/lib/api.ts`

- [ ] **Step 1: Add two new functions to `api.ts`, after the `importDomains` function (around line 165)**

```typescript
export async function importEmails(domainName: string): Promise<{ imported: number }> {
  const res = await api.post<{ imported: number }>(
    `/admin/domains/${domainName}/import-emails`
  );
  return res.data;
}

export async function importForwards(domainName: string): Promise<{ imported: number }> {
  const res = await api.post<{ imported: number }>(
    `/admin/domains/${domainName}/import-forwards`
  );
  return res.data;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/lib/api.ts
git commit -m "feat: add importEmails and importForwards API functions"
```

---

## Task 6: Frontend — wire "Load from cyon" buttons into DomainDetailPage

**Files:**
- Modify: `app/frontend/src/pages/DomainDetailPage.tsx`

The page uses `EmailsTab` and `ForwardsTab` as sub-components. We need to:
1. Read `user` from `useAuth` in `DomainDetailPage`
2. Pass `isAdmin: boolean` prop to each tab
3. In each tab, show a "Load from cyon" button when `isAdmin === true` that calls the import endpoint, shows a loading state, invalidates the query, and toasts the result

- [ ] **Step 1: Update imports at the top of `DomainDetailPage.tsx`**

Current import block (lines 1-36):
```typescript
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Copy, Check, RefreshCw } from "lucide-react";
import {
  fetchEmails,
  createEmail,
  deleteEmail,
  fetchForwards,
  createForward,
  deleteForward,
} from "@/lib/api";
```

Replace with:
```typescript
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Copy, Check, RefreshCw, Download } from "lucide-react";
import {
  fetchEmails,
  createEmail,
  deleteEmail,
  fetchForwards,
  createForward,
  deleteForward,
  importEmails,
  importForwards,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
```

- [ ] **Step 2: Update the `EmailsTab` component signature and add the import button**

Current signature (around line 566):
```typescript
function EmailsTab({ domain }: { domain: Domain }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailAccount | null>(null);
```

Replace with:
```typescript
function EmailsTab({ domain, isAdmin }: { domain: Domain; isAdmin: boolean }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailAccount | null>(null);
```

Then find the toolbar row in `EmailsTab` (the `<div className="flex items-center justify-between">` that contains `<QuotaCounter .../>` and the "New Email" button). Replace the entire `<div className="flex items-center justify-between">` block with:

```tsx
      <div className="flex items-center justify-between">
        {isLoading ? (
          <Skeleton className="h-5 w-40 bg-zinc-800" />
        ) : (
          <QuotaCounter
            used={emails?.length ?? 0}
            max={domain.max_emails}
            label="account"
          />
        )}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <ImportButton
              label="emails"
              onImport={() => importEmails(domain.name)}
              onSuccess={(n) => {
                queryClient.invalidateQueries({
                  queryKey: ["domains", domain.name, "emails"],
                });
                toast.success(
                  n > 0
                    ? `${n} email${n !== 1 ? "s" : ""} imported`
                    : "No new emails to import"
                );
              }}
            />
          )}
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Email
          </Button>
        </div>
      </div>
```

Note: `queryClient` is not yet in scope — add it at the top of `EmailsTab`:
```typescript
  const queryClient = useQueryClient();
```

- [ ] **Step 3: Update the `ForwardsTab` component signature and add the import button**

Current signature (around line 667):
```typescript
function ForwardsTab({ domain }: { domain: Domain }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailForward | null>(null);
```

Replace with:
```typescript
function ForwardsTab({ domain, isAdmin }: { domain: Domain; isAdmin: boolean }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailForward | null>(null);
```

Add `queryClient` at the top of `ForwardsTab`:
```typescript
  const queryClient = useQueryClient();
```

Replace the toolbar `<div className="flex items-center justify-between">` block in `ForwardsTab` with:

```tsx
      <div className="flex items-center justify-between">
        {isLoading ? (
          <Skeleton className="h-5 w-40 bg-zinc-800" />
        ) : (
          <QuotaCounter
            used={forwards?.length ?? 0}
            max={domain.max_forwards}
            label="forward"
          />
        )}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <ImportButton
              label="forwards"
              onImport={() => importForwards(domain.name)}
              onSuccess={(n) => {
                queryClient.invalidateQueries({
                  queryKey: ["domains", domain.name, "forwards"],
                });
                toast.success(
                  n > 0
                    ? `${n} forward${n !== 1 ? "s" : ""} imported`
                    : "No new forwards to import"
                );
              }}
            />
          )}
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Forward
          </Button>
        </div>
      </div>
```

- [ ] **Step 4: Add the `ImportButton` helper component**

Add this before the `EmailsTab` function definition (around line 565):

```tsx
// ── Import from cyon button ───────────────────────────────────────────────────

function ImportButton({
  label,
  onImport,
  onSuccess,
}: {
  label: string;
  onImport: () => Promise<{ imported: number }>;
  onSuccess: (n: number) => void;
}) {
  const mutation = useMutation({
    mutationFn: onImport,
    onSuccess: (data) => onSuccess(data.imported),
    onError: () => toast.error(`Failed to import ${label} from cyon`),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      Load from cyon
    </Button>
  );
}
```

- [ ] **Step 5: Read `user` from `useAuth` and pass `isAdmin` to both tabs in `DomainDetailPage`**

In the `DomainDetailPage` function (around line 766), add `useAuth` after the existing hooks:

```typescript
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
```

Then find the `<TabsContent value="emails" ...>` and `<TabsContent value="forwards" ...>` blocks and update them:

```tsx
        <TabsContent value="emails" className="mt-4">
          <EmailsTab domain={domain} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="forwards" className="mt-4">
          <ForwardsTab domain={domain} isAdmin={isAdmin} />
        </TabsContent>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/frontend/src/pages/DomainDetailPage.tsx
git commit -m "feat: add admin-only Load from cyon buttons to domain detail tabs"
```

---

## Self-Review

**Spec coverage:**
- ✅ `POST /api/admin/domains/{domain_name}/import-emails` — Task 2
- ✅ `POST /api/admin/domains/{domain_name}/import-forwards` — Task 3
- ✅ Admin-only (both endpoints use `require_admin`) — Tasks 2, 3
- ✅ Customers see no import buttons (`isAdmin` guard in frontend) — Task 6
- ✅ No passwords stored (imported emails have no password field) — Tasks 2
- ✅ "Import all missing" (no checkbox selection) — Tasks 2, 3
- ✅ Audit log entries written — Tasks 2, 3
- ✅ Toast feedback with count — Task 6
- ✅ Tests for both endpoints — Task 4

**Placeholder scan:** None found.

**Type consistency:**
- `ImportResult` schema (Task 1) → used in endpoint `response_model` (Tasks 2, 3) ✅
- `importEmails` / `importForwards` return `{ imported: number }` (Task 5) → `ImportButton.onImport` expects `Promise<{ imported: number }>` (Task 6) ✅
- `isAdmin: boolean` prop added to both tab signatures and passed from page (Task 6) ✅
