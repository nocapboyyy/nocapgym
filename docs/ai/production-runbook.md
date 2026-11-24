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

Run the executable deployment script from any directory. It defaults to `main`
and accepts another branch as its only argument:

```bash
/opt/nocapgym/scripts/deploy.sh
/opt/nocapgym/scripts/deploy.sh codex/code-review-remediation
```

For a stable command that remains available when switching to branches without
the script, install a copy outside the checkout after first pulling this change:

```bash
sudo install -m 755 /opt/nocapgym/scripts/deploy.sh /usr/local/bin/nocapgym-deploy
nocapgym-deploy
nocapgym-deploy BRANCH_NAME
```

Reinstall that copy when the deployment script changes. Run it as the normal
deployment user, not with `sudo`; it requests sudo only for service management.
`APP_DIR`, `API_SERVICE`, and `HEALTH_URL` override `/opt/nocapgym`,
`nocapgym-api`, and `http://127.0.0.1:4000/api/health`. Set `HEALTH_URL` if the
server uses another API port or to check the public HTTPS endpoint.

The script loads nvm from `NVM_DIR` or `~/.nvm` when available and selects
Node.js 22; otherwise it requires Node.js >=22.12 and <23 on PATH. It requires
`flock` (Ubuntu's util-linux), `sqlite3`, Git, curl, and systemd. It rejects dirty
checkouts, concurrent deployments, and local branch commits absent from the
remote branch. It fetches and pins the requested remote commit before stopping
the API, then switches branches, installs dependencies, verifies/builds the
code, backs up/migrates SQLite, starts the service, and checks API health.

The API stays stopped during dependency installation and build because this
deployment uses one shared checkout. Any failure after the stop leaves the API
stopped, including a failed health check after startup. No automatic code or
database rollback is attempted. Previous and target commits are saved in
`.git/nocapgym-deploy-state`; the verified database backup path is printed by
the migration wrapper. All target branches must provide the production migration
command. Switching branches does not reverse database migrations; use Recovery
when restoring an older database/code pair.

Validate the script locally with `bash -n scripts/deploy.sh` and
`python3 scripts/test_deploy.py`. The tests use temporary Git repositories and
mock server tools; they do not update a real service or database.

The equivalent manual sequence is below. Stop at the first error:

```bash
cd /opt/nocapgym
PREVIOUS_COMMIT=$(git rev-parse HEAD)
git switch main
git pull --ff-only origin main
nvm use
sudo systemctl stop nocapgym-api
npm ci
npm run prisma:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Create and verify a SQLite backup, apply migrations, and only then start the
new API:

```bash
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
