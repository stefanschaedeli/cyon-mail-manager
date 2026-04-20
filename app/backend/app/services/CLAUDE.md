# Services CLAUDE.md

## cyon.py — SSH + UAPI bridge

All SSH interactions go here. Never call paramiko from route handlers.

**Connection:** ed25519 key at `/data/ssh/id_ed25519`, host `s075.cyon.net`, user `swebdesi`.
`uapi` confirmed at `/usr/bin/uapi`. `cpapi2` NOT available — no fallback needed.

### UAPI commands

```bash
uapi --output=json Email list_pops_with_disk domain=example.ch
uapi --output=json Email add_pop email=user@example.ch password=SECRET quota=250
uapi --output=json Email delete_pop email=user@example.ch

uapi --output=json Email list_forwarders domain=example.ch
uapi --output=json Email add_forwarder domain=example.ch email=alias@example.ch fwdopt=fwd fwdemail=target@ext.com
uapi --output=json Email delete_forwarder address=alias@example.ch forwarder=target@ext.com
```

**Response:** `result.status` = `1` success / `0` error. Errors in `result.errors[]`.

### Forwarder field naming (CONFUSING — remap immediately)

cyon returns:
- `dest` = the SOURCE alias (the address that receives mail)
- `forward` = the DESTINATION target (where mail is sent)

Always remap in `list_forwards()`:
```python
return [{"source": e["dest"], "destination": e["forward"]} for e in result["data"]]
```

### list_pops_with_disk response fields
```
email        full address (primary key)
diskquota    "unlimited" or integer MB
diskused     MB as string
suspended_incoming / suspended_login   0=active 1=suspended
```

### Methods to implement
`list_emails(domain)`, `create_email(email, password, quota_mb)`, `delete_email(email)`,
`list_forwards(domain)`, `create_forward(domain, source, destination)`, `delete_forward(source, destination)`

All SSH calls are blocking → callers must wrap with `asyncio.to_thread()`.
Raise typed `CyonError` on UAPI failure.

## sync.py — DB ↔ cyon reconciliation

SQLite is a **cache**. cyon is source of truth.

- On create/delete: run UAPI first, update DB only on success
- Admin sync: pull from cyon, upsert DB, mark records missing on cyon as `synced=False`
