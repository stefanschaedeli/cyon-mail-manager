import json
import shlex

from app.core.ssh import SSHClient


class CyonError(Exception):
    pass


class CyonService:
    def __init__(self, ssh: SSHClient) -> None:
        self._ssh = ssh

    def _run(self, args: list[str]) -> dict:
        cmd = "uapi --output=json " + " ".join(shlex.quote(a) for a in args)
        try:
            output = self._ssh.execute(cmd)
        except RuntimeError as e:
            raise CyonError(f"SSH error: {e}") from e

        try:
            data = json.loads(output)
        except json.JSONDecodeError as e:
            raise CyonError(f"Invalid JSON from UAPI: {output[:200]}") from e

        result = data.get("result", {})
        if result.get("status") != 1:
            errors = result.get("errors") or []
            raise CyonError(f"UAPI error: {errors}")

        return result

    # ── Email accounts ────────────────────────────────────────────────────────

    def list_emails(self, domain: str) -> list[dict]:
        result = self._run(["Email", "list_pops_with_disk", f"domain={domain}"])
        return [
            {
                "email": e["email"],
                "quota_mb": 0 if e.get("diskquota") == "unlimited" else int(e.get("diskquota") or 0),
                "disk_used_mb": float(e.get("diskused") or 0),
            }
            for e in (result.get("data") or [])
        ]

    def create_email(self, email: str, password: str, quota_mb: int = 0) -> dict:
        self._run([
            "Email", "add_pop",
            f"email={email}",
            f"password={password}",
            f"quota={quota_mb}",
        ])
        return {"email": email, "quota_mb": quota_mb}

    def delete_email(self, email: str) -> None:
        self._run(["Email", "delete_pop", f"email={email}"])

    # ── Forwards ──────────────────────────────────────────────────────────────

    def list_forwards(self, domain: str) -> list[dict]:
        result = self._run(["Email", "list_forwarders", f"domain={domain}"])
        # cyon naming is confusing: dest=source alias, forward=destination target
        return [
            {
                "source": e["dest"],
                "destination": e["forward"],
            }
            for e in (result.get("data") or [])
        ]

    def create_forward(self, domain: str, source: str, destination: str) -> dict:
        self._run([
            "Email", "add_forwarder",
            f"domain={domain}",
            f"email={source}",
            "fwdopt=fwd",
            f"fwdemail={destination}",
        ])
        return {"source": source, "destination": destination}

    def delete_forward(self, source: str, destination: str) -> None:
        self._run([
            "Email", "delete_forwarder",
            f"address={source}",
            f"forwarder={destination}",
        ])


def get_cyon_service() -> CyonService:
    from app.config import settings
    ssh = SSHClient(
        host=settings.cyon_ssh_host,
        port=settings.cyon_ssh_port,
        user=settings.cyon_ssh_user,
        key_path=settings.cyon_ssh_key_path,
    )
    return CyonService(ssh)
