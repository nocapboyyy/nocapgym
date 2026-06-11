import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getTelegramUserFromInitData, isAdminTelegramId } from '../src/auth/telegram.js';

function signInitData(params: Record<string, string>, botToken: string) {
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

describe('telegram auth', () => {
  it('validates signed init data and returns the Telegram user', () => {
    const user = { id: 42, first_name: 'Ivan', username: 'ivan' };
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) },
      'bot-token'
    );

    expect(getTelegramUserFromInitData(initData, 'bot-token')).toEqual(user);
  });

  it('rejects tampered init data', () => {
    const user = { id: 42, first_name: 'Ivan' };
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) },
      'bot-token'
    ).replace('Ivan', 'Petr');

    expect(() => getTelegramUserFromInitData(initData, 'bot-token')).toThrow('Invalid Telegram init data');
  });

  it('checks admin ids from a comma separated whitelist', () => {
    expect(isAdminTelegramId(42, '11, 42,99')).toBe(true);
    expect(isAdminTelegramId(7, '11, 42,99')).toBe(false);
  });
});

