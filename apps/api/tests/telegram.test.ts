import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ExpiredTelegramInitDataError,
  getTelegramUserFromInitData,
  InvalidTelegramInitDataError,
  isAdminTelegramId
} from '../src/auth/telegram.js';

const nowSeconds = 2_000_000_000;
const validationOptions = { maxAgeSeconds: 86_400, clockSkewSeconds: 60, nowSeconds };

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
      { auth_date: String(nowSeconds - 86_400), user: JSON.stringify(user) },
      'bot-token'
    );

    expect(getTelegramUserFromInitData(initData, 'bot-token', validationOptions)).toEqual(user);
  });

  it('rejects tampered init data', () => {
    const user = { id: 42, first_name: 'Ivan' };
    const initData = signInitData(
      { auth_date: String(nowSeconds), user: JSON.stringify(user) },
      'bot-token'
    ).replace('Ivan', 'Petr');

    expect(() => getTelegramUserFromInitData(initData, 'bot-token', validationOptions)).toThrow(
      InvalidTelegramInitDataError
    );
  });

  it('rejects signed init data older than 86400 seconds', () => {
    const initData = signInitData(
      { auth_date: String(nowSeconds - 86_401), user: JSON.stringify({ id: 42 }) },
      'bot-token'
    );

    expect(() => getTelegramUserFromInitData(initData, 'bot-token', validationOptions)).toThrow(
      ExpiredTelegramInitDataError
    );
  });

  it('rejects signed init data too far in the future', () => {
    const initData = signInitData(
      { auth_date: String(nowSeconds + 61), user: JSON.stringify({ id: 42 }) },
      'bot-token'
    );

    expect(() => getTelegramUserFromInitData(initData, 'bot-token', validationOptions)).toThrow(
      InvalidTelegramInitDataError
    );
  });

  it.each([undefined, 'not-a-timestamp'])('rejects a missing or malformed auth_date: %s', (authDate) => {
    const params: Record<string, string> = { user: JSON.stringify({ id: 42 }) };
    if (authDate !== undefined) params.auth_date = authDate;
    const initData = signInitData(params, 'bot-token');

    expect(() => getTelegramUserFromInitData(initData, 'bot-token', validationOptions)).toThrow(
      InvalidTelegramInitDataError
    );
  });

  it('checks admin ids from a comma separated whitelist', () => {
    expect(isAdminTelegramId(42, '11, 42,99')).toBe(true);
    expect(isAdminTelegramId(7, '11, 42,99')).toBe(false);
  });
});
