import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function getTelegramUserFromInitData(initData: string, botToken: string): TelegramUser {
  if (!botToken) {
    throw new Error('Telegram bot token is not configured');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const userJson = params.get('user');

  if (!receivedHash || !userJson) {
    throw new Error('Invalid Telegram init data');
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const received = Buffer.from(receivedHash, 'hex');
  const calculated = Buffer.from(calculatedHash, 'hex');
  if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) {
    throw new Error('Invalid Telegram init data');
  }

  return JSON.parse(userJson) as TelegramUser;
}

export function isAdminTelegramId(telegramId: number | string, whitelist: string | undefined) {
  const normalizedId = String(telegramId);
  return (whitelist ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(normalizedId);
}

