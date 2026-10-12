import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export class InvalidTelegramInitDataError extends Error {
  constructor(message = 'Invalid Telegram init data') {
    super(message);
    this.name = 'InvalidTelegramInitDataError';
  }
}

export class ExpiredTelegramInitDataError extends InvalidTelegramInitDataError {
  constructor() {
    super('Expired Telegram init data');
    this.name = 'ExpiredTelegramInitDataError';
  }
}

export type TelegramInitDataValidationOptions = {
  maxAgeSeconds: number;
  clockSkewSeconds: number;
  nowSeconds?: number;
};

export function getTelegramUserFromInitData(
  initData: string,
  botToken: string,
  options: TelegramInitDataValidationOptions = { maxAgeSeconds: 86_400, clockSkewSeconds: 60 }
): TelegramUser {
  if (!botToken) {
    throw new Error('Telegram bot token is not configured');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const userJson = params.get('user');

  if (!receivedHash || !userJson) {
    throw new InvalidTelegramInitDataError();
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
    throw new InvalidTelegramInitDataError();
  }

  const authDateValue = params.get('auth_date');
  if (!authDateValue || !/^\d+$/.test(authDateValue)) {
    throw new InvalidTelegramInitDataError();
  }
  const authDate = Number(authDateValue);
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new InvalidTelegramInitDataError();
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (authDate > now + options.clockSkewSeconds) {
    throw new InvalidTelegramInitDataError();
  }
  if (now - authDate > options.maxAgeSeconds) {
    throw new ExpiredTelegramInitDataError();
  }

  try {
    const user = JSON.parse(userJson) as Partial<TelegramUser>;
    if (!Number.isSafeInteger(user.id)) throw new InvalidTelegramInitDataError();
    return user as TelegramUser;
  } catch (error) {
    if (error instanceof InvalidTelegramInitDataError) throw error;
    throw new InvalidTelegramInitDataError();
  }
}

export function isAdminTelegramId(telegramId: number | string, whitelist: string | undefined) {
  const normalizedId = String(telegramId);
  return (whitelist ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(normalizedId);
}
