import asyncio
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, log_action, verify_domain_access
from app.core.database import get_db
from app.models import Domain, EmailAccount, User
from app.schemas import EmailCreate, EmailOut
from app.services.cyon import CyonError, CyonService, get_cyon_service

router = APIRouter(prefix="/api/domains", tags=["emails"])

_EMAIL_LOCAL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+$")


@router.get("/{domain_name}/emails", response_model=list[EmailOut])
def list_emails(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    db: Annotated[Session, Depends(get_db)],
):
    return db.query(EmailAccount).filter(EmailAccount.domain_id == domain.id).all()


@router.post("/{domain_name}/emails", response_model=EmailOut, status_code=status.HTTP_201_CREATED)
async def create_email(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    body: EmailCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    if not _EMAIL_LOCAL_RE.match(body.local_part):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid local part")

    address = f"{body.local_part}@{domain.name}"

    if db.query(EmailAccount).filter(EmailAccount.address == address).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email address already exists")

    if domain.max_emails > 0:
        count = db.query(EmailAccount).filter(EmailAccount.domain_id == domain.id).count()
        if count >= domain.max_emails:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Email quota reached ({domain.max_emails} max)",
            )

    await asyncio.to_thread(cyon.create_email, address, body.password, body.quota_mb)

    account = EmailAccount(
        address=address,
        domain_id=domain.id,
        quota_mb=body.quota_mb,
        synced=True,
    )
    db.add(account)
    db.flush()
    log_action(db, current_user.id, "create_email", address)
    db.commit()
    db.refresh(account)
    return EmailOut.model_validate(account)


@router.delete("/{domain_name}/emails/{address:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    address: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    account = (
        db.query(EmailAccount)
        .filter(EmailAccount.address == address, EmailAccount.domain_id == domain.id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    await asyncio.to_thread(cyon.delete_email, address)

    log_action(db, current_user.id, "delete_email", address)
    db.delete(account)
    db.commit()
