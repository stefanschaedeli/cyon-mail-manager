from sqlalchemy.orm import Session

from app.models import Domain, EmailAccount, EmailForward
from app.services.cyon import CyonService


class SyncResult:
    def __init__(self) -> None:
        self.domains_synced = 0
        self.emails_added = 0
        self.emails_marked_unsynced = 0
        self.forwards_added = 0
        self.forwards_marked_unsynced = 0

    def to_dict(self) -> dict:
        return {
            "domains_synced": self.domains_synced,
            "emails_added": self.emails_added,
            "emails_marked_unsynced": self.emails_marked_unsynced,
            "forwards_added": self.forwards_added,
            "forwards_marked_unsynced": self.forwards_marked_unsynced,
        }


class SyncService:
    def sync_all(self, db: Session, cyon: CyonService) -> SyncResult:
        result = SyncResult()
        domains = db.query(Domain).all()

        for domain in domains:
            self._sync_domain(db, cyon, domain, result)
            result.domains_synced += 1

        db.commit()
        return result

    def _sync_domain(self, db: Session, cyon: CyonService, domain: Domain, result: SyncResult) -> None:
        # ── Email accounts ────────────────────────────────────────────────────
        try:
            remote_emails = {e["email"]: e for e in cyon.list_emails(domain.name)}
        except Exception:
            remote_emails = {}

        local_emails = {e.address: e for e in db.query(EmailAccount).filter(EmailAccount.domain_id == domain.id).all()}

        # In DB but not on cyon → mark unsynced
        for address, account in local_emails.items():
            if address not in remote_emails:
                account.synced = False
                result.emails_marked_unsynced += 1

        # On cyon but not in DB → insert
        for address, remote in remote_emails.items():
            if address not in local_emails:
                db.add(EmailAccount(
                    address=address,
                    domain_id=domain.id,
                    quota_mb=remote.get("quota_mb", 0),
                    synced=True,
                ))
                result.emails_added += 1
            else:
                local_emails[address].synced = True

        # ── Forwards ──────────────────────────────────────────────────────────
        try:
            remote_forwards = {
                (f["source"], f["destination"]): f
                for f in cyon.list_forwards(domain.name)
            }
        except Exception:
            remote_forwards = {}

        local_forwards = {
            (f.source, f.destination): f
            for f in db.query(EmailForward).filter(EmailForward.domain_id == domain.id).all()
        }

        # In DB but not on cyon → mark unsynced
        for key, fwd in local_forwards.items():
            if key not in remote_forwards:
                fwd.synced = False
                result.forwards_marked_unsynced += 1

        # On cyon but not in DB → insert
        for (source, destination), _ in remote_forwards.items():
            if (source, destination) not in local_forwards:
                db.add(EmailForward(
                    source=source,
                    destination=destination,
                    domain_id=domain.id,
                    synced=True,
                ))
                result.forwards_added += 1
            else:
                local_forwards[(source, destination)].synced = True
