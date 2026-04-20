import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.auth import decode_token
from app.core.database import get_db
from app.models import AuditLog, Domain, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def verify_domain_access(
    domain_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Domain:
    domain = db.query(Domain).filter(Domain.name == domain_name).first()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Domain '{domain_name}' not found")
    if current_user.role != "admin" and domain.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this domain")
    return domain


def log_action(db: Session, user_id: int | None, action: str, target: str, detail: dict | None = None) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target=target,
        detail=json.dumps(detail) if detail else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.flush()
