from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import admin, auth, emails, forwards
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Domain, User
from app.schemas import DomainOut

router = APIRouter()
router.include_router(auth.router)
router.include_router(admin.router)
router.include_router(emails.router)
router.include_router(forwards.router)


@router.get("/api/domains", response_model=list[DomainOut], tags=["domains"])
def list_my_domains(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if current_user.role == "admin":
        return db.query(Domain).all()
    return db.query(Domain).filter(Domain.user_id == current_user.id).all()
