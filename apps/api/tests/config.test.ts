import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';

describe('readConfig', () => {
  it('uses a 24 hour initData TTL and a 60 second clock skew by default', () => {
    const config = readConfig({ NODE_ENV: 'production' });

    expect(config.telegramInitDataMaxAgeSeconds).toBe(86_400);
    expect(config.telegramInitDataClockSkewSeconds).toBe(60);
  });

  it('reads valid initData lifetime settings from the environment', () => {
    const config = readConfig({
      TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: '7200',
      TELEGRAM_INIT_DATA_CLOCK_SKEW_SECONDS: '15'
    });

    expect(config.telegramInitDataMaxAgeSeconds).toBe(7200);
    expect(config.telegramInitDataClockSkewSeconds).toBe(15);
  });

  it.each([
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '0'],
    ['TELEGRAM_INIT_DATA_MAX_AGE_SECONDS', '1.5'],
    ['TELEGRAM_INIT_DATA_CLOCK_SKEW_SECONDS', '-1']
  ])('rejects invalid %s=%s', (name, value) => {
    expect(() => readConfig({ [name]: value })).toThrow(name);
  });
});
