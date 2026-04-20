from unittest.mock import patch

from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_admin_token(client: TestClient) -> str:
    res = client.post("/api/auth/login", json={"username": "admin", "password": "adminpass"})
    assert res.status_code == 200, res.text
    return res.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── import-emails ─────────────────────────────────────────────────────────────


def test_import_emails_inserts_missing(client: TestClient, db):
    token = _make_admin_token(client)

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

    # admin.py imports get_cyon_service lazily inside the function body via a
    # local `from` import, so patch at the source module.
    with patch("app.services.cyon.get_cyon_service") as mock_factory:
        mock_factory.return_value.list_emails.return_value = cyon_emails

        res = client.post(
            "/api/admin/domains/example.ch/import-emails",
            headers=_auth(token),
        )

    assert res.status_code == 201
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

    # create_email endpoint uses get_cyon_service via FastAPI Depends — the
    # conftest already overrides that dependency with client.mock_cyon.
    client.mock_cyon.create_email.return_value = {}
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
        mock_factory.return_value.list_emails.return_value = cyon_emails

        res = client.post(
            "/api/admin/domains/skip.ch/import-emails",
            headers=_auth(token),
        )

    assert res.status_code == 201
    assert res.json() == {"imported": 1}


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
        mock_factory.return_value.list_forwards.return_value = cyon_forwards

        res = client.post(
            "/api/admin/domains/fwd.ch/import-forwards",
            headers=_auth(token),
        )

    assert res.status_code == 201
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

    # create_forward endpoint uses get_cyon_service via FastAPI Depends —
    # the conftest override handles it via client.mock_cyon.
    client.mock_cyon.create_forward.return_value = {}
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
        mock_factory.return_value.list_forwards.return_value = cyon_forwards

        res = client.post(
            "/api/admin/domains/fwdskip.ch/import-forwards",
            headers=_auth(token),
        )

    assert res.status_code == 201
    assert res.json() == {"imported": 1}


def test_import_forwards_domain_not_found(client: TestClient, db):
    token = _make_admin_token(client)
    res = client.post(
        "/api/admin/domains/notexist.ch/import-forwards",
        headers=_auth(token),
    )
    assert res.status_code == 404
