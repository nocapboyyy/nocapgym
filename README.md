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

## Обновление стенда

**1. На локальной машине** откройте корень проекта и проверьте ветку и список изменений.

```bash
git branch --show-current
git status --short
```

Добавьте в коммит файлы обновления через `git add <пути>`. При первой публикации включите также `scripts/deploy.sh` и `scripts/test_deploy.py`. Проверьте состав коммита и отправьте текущую ветку на GitHub.

```bash
git diff --cached --stat
git commit -m "Обновление стенда"
git push -u origin HEAD
```

**2. На сервере** после входа по SSH выполните команды под пользователем деплоя. В примере указана ветка `codex/code-review-remediation`. Подставьте имя ветки из первого шага.

```bash
cd /opt/nocapgym
branch=codex/code-review-remediation
(
  set -e
  script=$(mktemp)
  trap 'rm -f "$script"' EXIT
  git fetch origin "refs/heads/$branch"
  git show FETCH_HEAD:scripts/deploy.sh > "$script"
  bash "$script" "$branch"
)
```

Эта команда подходит для первой установки и обновления самого скрипта. Для следующих выкладок, если скрипт уже есть на сервере и его код не менялся, достаточно `./scripts/deploy.sh "$branch"` из каталога проекта.

Скрипт остановит API, обновит код, запустит проверки и сборку, применит миграции с резервной копией существующей базы, запустит API и проверит `/api/health`. Признак успеха — строка «Обновление завершено» с веткой и коммитом. При сбое после остановки сервис может остаться выключенным. Порядок восстановления описан в [инструкции по эксплуатации](docs/ai/production-runbook.md#recovery).
