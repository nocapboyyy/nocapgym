import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildServer } from '../../src/server.js';

const migrationsRoot = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));

export const integrationAdminTelegramId = '9001';

export type IntegrationTestHarness = Awaited<ReturnType<typeof createIntegrationTestHarness>>;

export type IntegrationTestHarnessOptions = {
  beforeMigration?: (migrationName: string, prisma: PrismaClient) => Promise<void>;
};

export async function createIntegrationTestHarness(options: IntegrationTestHarnessOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'nocapgym-api-test-'));
  const databaseUrl = `file:${join(directory, 'test.db')}`;
  let prisma: PrismaClient | undefined;

  try {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    prisma = client;
    await applyMigrations(client, options);
    const app = await buildServer({
      prisma: client,
      config: {
        botToken: 'integration-test-token',
        adminTelegramIds: integrationAdminTelegramId,
        port: 4000,
        allowDevAuth: true,
        telegramInitDataMaxAgeSeconds: 86_400,
        telegramInitDataClockSkewSeconds: 60
      }
    });

    return {
      app,
      prisma: client,
      authHeaders(telegramId: string) {
        return {
          'x-dev-telegram-id': telegramId,
          'x-dev-first-name': `User ${telegramId}`,
          'x-dev-username': `user_${telegramId}`
        };
      },
      async close() {
        await app.close();
        await client.$disconnect();
        await rm(directory, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await prisma?.$disconnect();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function applyMigrations(prisma: PrismaClient, options: IntegrationTestHarnessOptions) {
  const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const directory of migrationDirectories) {
    await options.beforeMigration?.(directory, prisma);
    const sql = await readFile(join(migrationsRoot, directory, 'migration.sql'), 'utf8');
    for (const statement of splitSqlStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | '`' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];
    current += character;

    if (quote) {
      if (character === quote && nextCharacter === quote) {
        current += nextCharacter;
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === ';') {
      const statement = current.slice(0, -1).trim();
      if (statement) statements.push(statement);
      current = '';
    }
  }

  const remainder = current.trim();
  if (remainder) statements.push(remainder);
  return statements;
}
