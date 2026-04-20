#!/bin/sh
set -e

# Ensure the /data directory (volume mount) is writable by appuser.
# On first run the host directory may be owned by root; a privileged init
# container or host-side `chown` is the proper fix. We emit a clear error
# rather than silently failing.
if [ ! -w /data ]; then
    echo "ERROR: /data is not writable. Run: chown -R <uid>:appuser /data on the host." >&2
    exit 1
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
