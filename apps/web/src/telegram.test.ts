import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTelegramVerticalSwipesEnabled } from './telegram';

describe('setTelegramVerticalSwipesEnabled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables and enables Telegram vertical swipes when supported', () => {
    const disableVerticalSwipes = vi.fn();
    const enableVerticalSwipes = vi.fn();
    vi.stubGlobal('window', {
      Telegram: {
        WebApp: {
          disableVerticalSwipes,
          enableVerticalSwipes
        }
      }
    });

    setTelegramVerticalSwipesEnabled(false);
    setTelegramVerticalSwipesEnabled(true);

    expect(disableVerticalSwipes).toHaveBeenCalledOnce();
    expect(enableVerticalSwipes).toHaveBeenCalledOnce();
  });

  it('does not throw outside Telegram', () => {
    vi.stubGlobal('window', {});

    expect(() => setTelegramVerticalSwipesEnabled(false)).not.toThrow();
  });
});
