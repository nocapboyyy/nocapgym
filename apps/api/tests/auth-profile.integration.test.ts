import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createIntegrationTestHarness, type IntegrationTestHarness } from './helpers/integration.js';
import { signInitData } from './helpers/signed-init-data.js';
import type { TelegramUser } from '../src/auth/telegram.js';

let h: IntegrationTestHarness;
const queries: string[] = [];
const writes = () => queries.filter(sql => /^(INSERT INTO|UPDATE) .*`User`/i.test(sql));

async function flushQueryEvents() {
  // Prisma delivers SQL events asynchronously. Wait for a trailing marker before counting.
  const offset = queries.length;
  await h.prisma.$queryRaw`SELECT 1 AS auth_query_barrier`;
  await vi.waitFor(() => expect(queries.slice(offset)).toContain('SELECT 1 AS auth_query_barrier'));
}

function headers(user: TelegramUser, age = 0) {
  const initData = signInitData({
    auth_date: String(Math.floor(Date.now() / 1000) - age),
    user: JSON.stringify(user)
  }, 'integration-test-token');
  return { 'x-telegram-init-data': initData };
}
beforeEach(async () => {
  h = await createIntegrationTestHarness({ onQuery: sql => queries.push(sql) });
  queries.length = 0;
});
afterEach(async () => { await h.close(); });

it('serves repeated signed reads without writing an unchanged profile', async () => {
  const auth = headers({ id: 42, first_name: 'Иван' });
  expect((await h.app.inject({ url: '/api/me', headers: auth })).statusCode).toBe(200);
  await flushQueryEvents();
  expect(writes()).toHaveLength(1);
  queries.length = 0;
  const urls = ['/api/me', '/api/templates/summary', '/api/sessions/active', '/api/exercises'];
  for (let i = 0; i < 3; i++) {
    const responses = await Promise.all(urls.map(url => h.app.inject({ url, headers: auth })));
    expect(responses.map(response => response.statusCode)).toEqual([200, 200, 200, 200]);
  }
  await flushQueryEvents();
  expect(writes()).toHaveLength(0);
});

it('creates a single account on concurrent first access', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () =>
    h.app.inject({ url: '/api/me', headers: headers({ id: 42 }) })));
  expect(responses.every(response => response.statusCode === 200)).toBe(true);
  expect(new Set(responses.map(response => response.json().user.id)).size).toBe(1);
  expect(await h.prisma.user.count()).toBe(1);
});

it('syncs changed or absent Telegram fields while preserving a concurrent gender change', async () => {
  const old = headers({ id: 42, first_name: 'Иван', last_name: 'Иванов', username: 'ivan' });
  await h.app.inject({ url: '/api/me', headers: old });
  const renamed = headers({ id: 42, first_name: 'Иван', last_name: 'Иванов', username: 'ivan2' });
  expect((await h.app.inject({ url: '/api/me', headers: renamed })).json().user.username).toBe('ivan2');
  const auth = headers({ id: 42 });
  const responses = await Promise.all([
    h.app.inject({ url: '/api/me', headers: auth }),
    h.app.inject({ method: 'PATCH', url: '/api/me', headers: auth, payload: { gender: 'male' } })
  ]);
  expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
  expect(await h.prisma.user.findUniqueOrThrow({ where: { telegramId: '42' } })).toMatchObject({
    firstName: null, lastName: null, username: null, gender: 'male'
  });
});

it('rejects expired and tampered credentials even for an existing admin', async () => {
  const admin = { id: 9001, first_name: 'Admin' };
  const valid = headers(admin);
  const url = '/api/admin/exercises';
  expect((await h.app.inject({ url, headers: valid })).statusCode).toBe(200);
  await flushQueryEvents();
  queries.length = 0;
  for (const auth of [headers(admin, 90_000), { 'x-telegram-init-data': valid['x-telegram-init-data'].replace('Admin', 'Other') }]) {
    expect((await h.app.inject({ url, headers: auth })).statusCode).toBe(401);
  }
  await flushQueryEvents();
  expect(queries).toEqual(['SELECT 1 AS auth_query_barrier']);
  expect((await h.app.inject({ url, headers: headers({ id: 42 }) })).statusCode).toBe(403);
});
