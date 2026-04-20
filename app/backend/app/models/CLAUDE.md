# Models CLAUDE.md

SQLAlchemy 2.0 models. Use `Mapped[]` + `mapped_column()` syntax throughout.

## Tables

### users
| Column        | Type         | Notes                    |
|---------------|--------------|--------------------------|
| id            | INTEGER PK   | autoincrement            |
| username      | TEXT UNIQUE  |                          |
| email         | TEXT         |                          |
| password_hash | TEXT         | bcrypt                   |
| role          | TEXT         | "admin" or "customer"    |
| is_active     | BOOLEAN      | default true             |
| created_at    | DATETIME     |                          |

### domains
| Column       | Type        | Notes                        |
|--------------|-------------|------------------------------|
| id           | INTEGER PK  |                              |
| name         | TEXT UNIQUE | e.g. "example.ch"            |
| user_id      | FK → users  | owning customer              |
| max_emails   | INTEGER     | 0 = unlimited                |
| max_forwards | INTEGER     | 0 = unlimited                |
| created_at   | DATETIME    |                              |

### email_accounts
| Column    | Type         | Notes                         |
|-----------|--------------|-------------------------------|
| id        | INTEGER PK   |                               |
| address   | TEXT UNIQUE  | full: user@domain.ch          |
| domain_id | FK → domains |                               |
| quota_mb  | INTEGER      | MB                            |
| synced    | BOOLEAN      | true if confirmed on cyon     |
| created_at| DATETIME     |                               |

### email_forwards
| Column      | Type         | Notes                         |
|-------------|--------------|-------------------------------|
| id          | INTEGER PK   |                               |
| source      | TEXT         | alias@domain.ch               |
| destination | TEXT         | target@external.com           |
| domain_id   | FK → domains |                               |
| synced      | BOOLEAN      |                               |
| created_at  | DATETIME     |                               |

One source can have MULTIPLE destination rows — each source→destination pair is its own row.

### audit_log
| Column     | Type        | Notes                          |
|------------|-------------|--------------------------------|
| id         | INTEGER PK  |                                |
| user_id    | FK → users  | who did it                     |
| action     | TEXT        | create_email, delete_forward…  |
| target     | TEXT        | affected address               |
| detail     | TEXT        | optional JSON context          |
| created_at | DATETIME    |                                |
