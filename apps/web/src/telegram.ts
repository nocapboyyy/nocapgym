type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function initTelegramApp() {
  window.Telegram?.WebApp.ready();
  window.Telegram?.WebApp.expand();
}

export function getAuthHeaders(): Record<string, string> {
  const initData = window.Telegram?.WebApp.initData;
  if (initData) {
    return { 'x-telegram-init-data': initData };
  }

  return {
    'x-dev-telegram-id': localStorage.getItem('devTelegramId') ?? '1001',
    'x-dev-first-name': 'Dev',
    'x-dev-username': 'dev_user'
  };
}

