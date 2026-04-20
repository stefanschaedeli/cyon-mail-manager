import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import MagicMock

# Use in-memory SQLite for tests.  StaticPool forces all connections to share
# the same in-memory database so that tables created by create_all() are
# visible to sessions opened later in the same process.
TEST_DATABASE_URL = "sqlite:///:memory:"

os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-long-xx")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "adminpass")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("CYON_SSH_HOST", "localhost")
os.environ.setdefault("CYON_SSH_PORT", "22")
os.environ.setdefault("CYON_SSH_USER", "test")
os.environ.setdefault("CYON_SSH_KEY_PATH", "/tmp/test_key")


@pytest.fixture()
def client():
    from unittest.mock import patch

    from app.core.database import Base, get_db
    from app.main import app
    from app.services.cyon import get_cyon_service

    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Provide a no-op cyon service by default so endpoints that inject it via
    # Depends(get_cyon_service) don't try to open a real SSH connection.
    mock_cyon_instance = MagicMock()

    def override_get_cyon_service():
        return mock_cyon_instance

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_cyon_service] = override_get_cyon_service

    # Seed the admin user directly into the test engine before the app starts.
    # We also patch _create_default_admin so the lifespan does not try to use
    # the production SessionLocal (which points at a separate in-memory DB).
    from app.core.auth import hash_password
    from app.models import User
    db = TestingSessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                email="admin@test.com",
                password_hash=hash_password("adminpass"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

    # auth.py creates its own Limiter instance (separate from app.state.limiter).
    # Reset it before each test so login calls from previous tests don't
    # exhaust the 5/minute quota and cause 429s.
    try:
        from app.api.auth import limiter as auth_limiter
        auth_limiter.reset()
    except Exception:
        pass

    with patch("app.main._create_default_admin"):
        with TestClient(app, raise_server_exceptions=True) as c:
            # Expose the mock instance so individual tests can configure it.
            c.mock_cyon = mock_cyon_instance
            yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db(client):
    """Expose the DB session for direct inspection in tests."""
    from app.core.database import get_db
    override = client.app.dependency_overrides.get(get_db)
    db = next(override())
    try:
        yield db
    finally:
        db.close()
