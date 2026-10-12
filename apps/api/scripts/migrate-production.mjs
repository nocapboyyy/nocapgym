import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const schemaDirectory = join(apiRoot, 'prisma');
const schemaPath = join(schemaDirectory, 'schema.prisma');

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(join(apiRoot, '.env'));
  } catch {
    // Production may provide DATABASE_URL through systemd instead of an env file.
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('file:')) {
  fail('DATABASE_URL must be an explicit SQLite file: URL');
}

const databasePath = resolveSqlitePath(databaseUrl);
mkdirSync(dirname(databasePath), { recursive: true });

let backupPath;
if (existsSync(databasePath) && statSync(databasePath).size > 0) {
  const backupDirectory = resolve(
    process.env.SQLITE_BACKUP_DIR ?? join(dirname(databasePath), 'backups')
  );
  mkdirSync(backupDirectory, { recursive: true });
  backupPath = join(
    backupDirectory,
    `${basename(databasePath)}.${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.bak`
  );
  runSqlite(databasePath, `.backup '${escapeSqlitePath(backupPath)}'`);
  assertIntegrity(backupPath, 'backup');
  console.log(`Verified SQLite backup: ${backupPath}`);
} else if (!existsSync(databasePath)) {
  writeFileSync(databasePath, '');
  console.log(`Initialized empty SQLite database: ${databasePath}`);
}

const prismaCli = require.resolve('prisma/build/index.js');
const migration = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
  {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit'
  }
);

if (migration.error || migration.status !== 0) {
  if (backupPath) console.error(`Migration failed. Verified backup is available at: ${backupPath}`);
  fail(migration.error?.message ?? `prisma migrate deploy exited with status ${migration.status}`);
}

assertIntegrity(databasePath, 'migrated database');
console.log(`Migration completed; SQLite integrity check passed: ${databasePath}`);

function resolveSqlitePath(url) {
  const withoutQuery = url.slice('file:'.length).split('?', 1)[0];
  if (!withoutQuery) fail('DATABASE_URL does not contain a SQLite file path');
  const decoded = decodeURIComponent(withoutQuery);
  return isAbsolute(decoded) ? decoded : resolve(schemaDirectory, decoded);
}

function escapeSqlitePath(path) {
  return path.replaceAll("'", "''");
}

function runSqlite(path, command) {
  const result = spawnSync('sqlite3', [path, command], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    fail(result.error?.message ?? (result.stderr.trim() || `sqlite3 exited with status ${result.status}`));
  }
  return result.stdout.trim();
}

function assertIntegrity(path, label) {
  const result = runSqlite(path, 'PRAGMA integrity_check;');
  if (result !== 'ok') fail(`SQLite integrity check failed for ${label}: ${result}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
