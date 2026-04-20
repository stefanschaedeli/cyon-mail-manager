from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import log_action, require_admin
from app.core.auth import hash_password
from app.core.database import get_db
from app.services.cyon import CyonService, get_cyon_service
from app.models import AuditLog, Domain, EmailAccount, EmailForward, User
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

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return db.query(User).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    log_action(db, admin.id, "create_user", body.username)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.email is not None:
        user.email = body.email
    if body.is_active is not None:
        user.is_active = body.is_active

    log_action(db, admin.id, "update_user", user.username)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    domain_count = db.query(Domain).filter(Domain.user_id == user_id).count()
    if domain_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete user: {domain_count} domain(s) still assigned. Reassign domains first.",
        )

    log_action(db, admin.id, "delete_user", user.username)
    db.delete(user)
    db.commit()


# ── Domains ───────────────────────────────────────────────────────────────────

@router.get("/domains", response_model=list[DomainOut])
def list_domains(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    return db.query(Domain).all()


@router.post("/domains", response_model=DomainOut, status_code=status.HTTP_201_CREATED)
def create_domain(
    body: DomainCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    if db.query(Domain).filter(Domain.name == body.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Domain already exists")

    if body.user_id is not None:
        owner = db.query(User).filter(User.id == body.user_id).first()
        if not owner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if owner.role != "customer":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domains can only be assigned to customers")

    domain = Domain(
        name=body.name,
        user_id=body.user_id,
        max_emails=body.max_emails,
        max_forwards=body.max_forwards,
    )
    db.add(domain)
    db.flush()
    log_action(db, admin.id, "create_domain", body.name)
    db.commit()
    db.refresh(domain)
    return DomainOut.model_validate(domain)


@router.put("/domains/{domain_id}", response_model=DomainOut)
def update_domain(
    domain_id: int,
    body: DomainUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    if body.user_id is not None:
        owner = db.query(User).filter(User.id == body.user_id).first()
        if not owner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if owner.role != "customer":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domains can only be assigned to customers")
        domain.user_id = body.user_id
    if body.max_emails is not None:
        domain.max_emails = body.max_emails
    if body.max_forwards is not None:
        domain.max_forwards = body.max_forwards

    log_action(db, admin.id, "update_domain", domain.name)
    db.commit()
    db.refresh(domain)
    return DomainOut.model_validate(domain)


@router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_domain(
    domain_id: int,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    log_action(db, admin.id, "delete_domain", domain.name)
    db.delete(domain)
    db.commit()


# ── Cyon domain discovery + import ───────────────────────────────────────────

@router.get("/domains/cyon", response_model=list[str])
async def list_cyon_domains(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    import asyncio
    from app.services.cyon import get_cyon_service

    cyon = get_cyon_service()
    cyon_domains = await asyncio.to_thread(cyon.list_domains)
    existing = {d.name for d in db.query(Domain).all()}
    return [d for d in cyon_domains if d not in existing]


@router.post("/domains/import", response_model=list[DomainOut], status_code=status.HTTP_201_CREATED)
def import_domains(
    body: DomainImportRequest,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    existing = {d.name for d in db.query(Domain).all()}
    created = []
    for name in body.domains:
        if name in existing:
            continue
        domain = Domain(name=name, user_id=None, max_emails=0, max_forwards=0)
        db.add(domain)
        db.flush()
        log_action(db, admin.id, "domain_import", name)
        created.append(domain)
        existing.add(name)
    db.commit()
    for d in created:
        db.refresh(d)
    return [DomainOut.model_validate(d) for d in created]


@router.post("/domains/{domain_name}/import-emails", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_emails(
    domain_name: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    import asyncio

    domain = db.query(Domain).filter(Domain.name == domain_name).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    cyon_emails = await asyncio.to_thread(cyon.list_emails, domain_name)

    existing = {
        a.address
        for a in db.query(EmailAccount).filter(EmailAccount.domain_id == domain.id).all()
    }

    count = 0
    try:
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
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Import failed")
    return ImportResult(imported=count)


@router.post("/domains/{domain_name}/import-forwards", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_forwards(
    domain_name: str,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    import asyncio

    domain = db.query(Domain).filter(Domain.name == domain_name).first()
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    cyon_forwards = await asyncio.to_thread(cyon.list_forwards, domain_name)

    existing = {
        (f.source, f.destination)
        for f in db.query(EmailForward).filter(EmailForward.domain_id == domain.id).all()
    }

    count = 0
    try:
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
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Import failed")
    return ImportResult(imported=count)


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit", response_model=list[AuditOut])
def list_audit(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = 1,
    per_page: int = 50,
):
    offset = (page - 1) * per_page
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )


# ── Sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync")
async def trigger_sync(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    import asyncio
    from app.services.cyon import get_cyon_service
    from app.services.sync import SyncService

    cyon = get_cyon_service()
    sync = SyncService()
    result = await asyncio.to_thread(sync.sync_all, db, cyon)
    log_action(db, admin.id, "sync", "all", result.to_dict())
    db.commit()
    return result.to_dict()
