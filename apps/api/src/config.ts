export type AppConfig = {
  botToken: string;
  adminTelegramIds: string;
  port: number;
  allowDevAuth: boolean;
  telegramInitDataMaxAgeSeconds: number;
  telegramInitDataClockSkewSeconds: number;
};

function readInteger(value: string | undefined, fallback: number, name: string, minimum: number) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

export function readConfig(env = process.env): AppConfig {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN ?? '',
    adminTelegramIds: env.ADMIN_TELEGRAM_IDS ?? '',
    port: Number(env.API_PORT ?? 4000),
    allowDevAuth: env.NODE_ENV !== 'production' || env.ALLOW_DEV_AUTH === 'true',
    telegramInitDataMaxAgeSeconds: readInteger(
      env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
      86_400,
      'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
      1
    ),
    telegramInitDataClockSkewSeconds: readInteger(
      env.TELEGRAM_INIT_DATA_CLOCK_SKEW_SECONDS,
      60,
      'TELEGRAM_INIT_DATA_CLOCK_SKEW_SECONDS',
      0
    )
  };
}
