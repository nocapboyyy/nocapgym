export type AppConfig = {
  botToken: string;
  adminTelegramIds: string;
  port: number;
  allowDevAuth: boolean;
};

export function readConfig(env = process.env): AppConfig {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN ?? '',
    adminTelegramIds: env.ADMIN_TELEGRAM_IDS ?? '',
    port: Number(env.API_PORT ?? 4000),
    allowDevAuth: env.NODE_ENV !== 'production' || env.ALLOW_DEV_AUTH === 'true'
  };
}

