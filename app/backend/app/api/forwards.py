import asyncio
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, log_action, verify_domain_access
from app.core.database import get_db
from app.core.limiter import limiter
from app.models import Domain, EmailForward, User
from app.schemas import ForwardCreate, ForwardOut, ImportResult
from app.services.cyon import CyonError, CyonService, get_cyon_service

router = APIRouter(prefix="/api/domains", tags=["forwards"])

_EMAIL_LOCAL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+$")
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


@router.get("/{domain_name}/forwards", response_model=list[ForwardOut])
def list_forwards(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    db: Annotated[Session, Depends(get_db)],
):
    return db.query(EmailForward).filter(EmailForward.domain_id == domain.id).all()


@router.post("/{domain_name}/forwards", response_model=ForwardOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_forward(
    request: Request,
    domain: Annotated[Domain, Depends(verify_domain_access)],
    body: ForwardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    if not _EMAIL_LOCAL_RE.match(body.source_local):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid source local part")
    if not _EMAIL_RE.match(body.destination):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid destination email")

    source = f"{body.source_local}@{domain.name}"

    if domain.max_forwards > 0:
        count = db.query(EmailForward).filter(EmailForward.domain_id == domain.id).count()
        if count >= domain.max_forwards:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forward quota reached ({domain.max_forwards} max)",
            )

    existing = (
        db.query(EmailForward)
        .filter(
            EmailForward.domain_id == domain.id,
            EmailForward.source == source,
            EmailForward.destination == body.destination,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Forward already exists")

    await asyncio.to_thread(cyon.create_forward, domain.name, source, body.destination)

    forward = EmailForward(
        source=source,
        destination=body.destination,
        domain_id=domain.id,
        synced=True,
    )
    db.add(forward)
    db.flush()
    log_action(db, current_user.id, "create_forward", f"{source} → {body.destination}")
    db.commit()
    db.refresh(forward)
    return ForwardOut.model_validate(forward)


@router.post("/{domain_name}/import-forwards", status_code=status.HTTP_201_CREATED)
async def import_forwards(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    existing = {
        (f.source, f.destination)
        for f in db.query(EmailForward).filter(EmailForward.domain_id == domain.id).all()
    }

    count = 0
    try:
        cyon_forwards = await asyncio.to_thread(cyon.list_forwards, domain.name)
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
            log_action(db, current_user.id, "import_forward", f"{item['source']} → {item['destination']}")
            count += 1
        db.commit()
    except CyonError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"cyon error: {e}")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Import failed")
    return ImportResult(imported=count)


@router.delete("/{domain_name}/forwards/{forward_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_forward(
    domain: Annotated[Domain, Depends(verify_domain_access)],
    forward_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cyon: Annotated[CyonService, Depends(get_cyon_service)],
):
    forward = (
        db.query(EmailForward)
        .filter(EmailForward.id == forward_id, EmailForward.domain_id == domain.id)
        .first()
    )
    if not forward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forward not found")

    await asyncio.to_thread(cyon.delete_forward, forward.source, forward.destination)

    log_action(db, current_user.id, "delete_forward", f"{forward.source} → {forward.destination}")
    db.delete(forward)
    db.commit()
