# Production Deployment Runbook

This runbook applies to the current Ubuntu VPS, systemd, and SQLite deployment.

## Preconditions

- Use Node.js 22 (`nvm use` reads the repository `.nvmrc`). Prisma 6 does not
  officially support Node.js 24.
- Install the `sqlite3` CLI. The migration command uses it for consistent
  backups and integrity checks.
- Keep `DATABASE_URL` in `apps/api/.env` or the process environment. An
  absolute SQLite URL such as `file:/opt/nocapgym/data/production.db` is
  preferred in production.
- Know the last successfully deployed Git commit before starting.

## Deploy

Prepare and verify the new code while the current API is still running:

```bash
cd /opt/nocapgym
PREVIOUS_COMMIT=$(git rev-parse HEAD)
git pull --ff-only
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Stop writes, create and verify a SQLite backup, apply migrations, and only then
start the new API:

```bash
sudo systemctl stop nocapgym-api
npm run prisma:migrate:deploy
sudo systemctl start nocapgym-api
sudo systemctl status nocapgym-api --no-pager
```

`prisma:migrate:deploy` performs these steps:

1. Resolves the SQLite file from `DATABASE_URL`.
2. Creates a new empty file when deploying a clean database.
3. For an existing database, creates a timestamped backup in the adjacent
   `backups` directory, or in `SQLITE_BACKUP_DIR` when configured.
4. Requires `PRAGMA integrity_check` to return `ok` for the backup.
5. Runs `prisma migrate deploy`.
6. Requires `PRAGMA integrity_check` to return `ok` for the migrated database.

If backup creation, backup verification, migration, or the final integrity
check fails, the command exits non-zero. Do not start the API.

## Post-deploy Verification

```bash
curl --fail --silent https://YOUR_DOMAIN/api/health
sudo journalctl -u nocapgym-api -n 100 --no-pager
```

Open the Telegram Mini App and verify authentication, the plan list, active
workout restoration, and history with a non-admin account. Verify the admin
catalog separately with an allowed Telegram ID.

## Recovery

If migration or application verification fails, keep the API stopped. Use the
exact verified backup path printed by the migration command.

```bash
sudo systemctl stop nocapgym-api
sqlite3 /ABSOLUTE/PATH/TO/BACKUP.db "PRAGMA integrity_check;"
mv /ABSOLUTE/PATH/TO/production.db /ABSOLUTE/PATH/TO/production.failed.db
cp -p /ABSOLUTE/PATH/TO/BACKUP.db /ABSOLUTE/PATH/TO/production.db
git checkout "$PREVIOUS_COMMIT"
npm ci
npm run build
sudo systemctl start nocapgym-api
sudo systemctl status nocapgym-api --no-pager
```

Do not use `prisma migrate reset` in production. Do not mark a failed migration
as applied with `prisma migrate resolve` until its SQL and the actual database
state have been investigated on a copy.
