#!/bin/sh
set -e

# Startup sequence for the API container, per the Module 7 lab.
#
# depends_on only guarantees the Postgres *container* has started, not that the
# database is accepting connections — so wait for the port before doing anything
# that needs it.
#
# Run via `bash` explicitly rather than executed directly, because the
# `./api:/app` bind mount in docker-compose.yml replaces whatever the image's
# chmod set at build time with the file's actual permission on the host --
# and git stores this script as mode 644 (non-executable), committed from
# Windows, where the exec bit is never meaningfully set. Docker Desktop's
# Windows bind-mount layer masks this by presenting every file as 777
# regardless of git's stored mode; a native Linux bind mount (EC2) does not,
# so a direct invocation fails there with "Permission denied" even though the
# exact same image works locally. `bash`, not `sh`, because the script uses
# bash arrays and [[ ]] and `sh` is dash on this image.
echo "Waiting for Postgres..."
bash /app/wait-for-it.sh postgres:5432 --timeout=60 --strict -- echo "Postgres is up"

# migrate deploy (not migrate dev): applies the committed migrations exactly as
# they are, never generates new ones. That is the correct command for a
# non-interactive environment.
echo "Applying migrations..."
npx prisma migrate deploy

# The seed is idempotent (upserts throughout), so running it on every start is
# safe and means a fresh volume comes up already populated with Assessment 1's
# content rather than an empty site.
echo "Seeding..."
npm run db:seed

echo "Starting API..."
exec npm run start
