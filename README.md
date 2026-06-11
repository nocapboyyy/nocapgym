# Telegram Mini App для тренировок

Личный/публичный Telegram Mini App для составления тренировок, ведения дневника и просмотра прогресса. Любой Telegram-пользователь получает отдельную учетную запись при первом входе, админские функции доступны только Telegram ID из whitelist.

## Стек

- `apps/api`: Fastify + Prisma + SQLite + TypeScript.
- `apps/web`: React + Vite + TypeScript.

## Быстрый старт

```bash
npm install
cp .env.example apps/api/.env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Для локальной разработки вне Telegram можно включить mock-пользователя в UI: если Telegram WebApp недоступен, frontend отправляет `x-dev-telegram-id`.

