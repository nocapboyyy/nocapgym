import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('../scripts/migrate-production.mjs', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('production migration command', () => {
  it('deploys a clean SQLite database and creates a verified backup on the next run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nocapgym-production-migration-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'production.db');
    const backupDirectory = join(directory, 'backups');
    const env = {
      ...process.env,
      DATABASE_URL: `file:${databasePath}`,
      SQLITE_BACKUP_DIR: backupDirectory
    };

    execFileSync(process.execPath, [scriptPath], { env, stdio: 'pipe' });
    const migrationCount = execFileSync(
      'sqlite3',
      [databasePath, 'SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;'],
      { encoding: 'utf8' }
    ).trim();
    expect(migrationCount).toBe('5');

    execFileSync(process.execPath, [scriptPath], { env, stdio: 'pipe' });
    const backups = await readdir(backupDirectory);
    expect(backups).toHaveLength(1);
    const backupIntegrity = execFileSync(
      'sqlite3',
      [join(backupDirectory, backups[0]), 'PRAGMA integrity_check;'],
      { encoding: 'utf8' }
    ).trim();
    expect(backupIntegrity).toBe('ok');

    execFileSync('sqlite3', [databasePath, 'CREATE TABLE RestoreProbe (id INTEGER PRIMARY KEY);']);
    await copyFile(join(backupDirectory, backups[0]), databasePath);
    const restoredProbeCount = execFileSync(
      'sqlite3',
      [databasePath, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'RestoreProbe';"],
      { encoding: 'utf8' }
    ).trim();
    expect(restoredProbeCount).toBe('0');
    expect(execFileSync('sqlite3', [databasePath, 'PRAGMA integrity_check;'], { encoding: 'utf8' }).trim()).toBe(
      'ok'
    );
  });
});
