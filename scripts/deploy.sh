#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'HELP'
Использование: deploy.sh [ветка]
  deploy.sh                              обновить main
  deploy.sh codex/code-review-remediation обновить выбранную ветку

Настройки через окружение:
  APP_DIR      папка приложения (по умолчанию /opt/nocapgym)
  API_SERVICE  сервис systemd (по умолчанию nocapgym-api)
  HEALTH_URL   адрес проверки (по умолчанию http://127.0.0.1:4000/api/health)

Запускайте от пользователя с доступом к репозиторию, базе и sudo.
HELP
}

die() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }

service_touched=false
previous_commit=''
on_exit() {
  local result=$?
  if (( result != 0 )) && [[ "$service_touched" == true ]]; then
    if sudo systemctl stop "$api_service"; then
      printf '\nОбновление не завершено. API остановлен.\n' >&2
    else
      printf '\nОбновление не завершено. Не удалось остановить API; проверьте systemctl.\n' >&2
    fi
    printf 'Автоматический откат не выполнялся.\n' >&2
    printf 'Предыдущий коммит: %s\nВосстановление: docs/ai/production-runbook.md (Recovery).\n' "$previous_commit" >&2
  fi
}

main() {
  if [[ ${1:-} == --help || ${1:-} == -h ]]; then usage; return; fi
  (( $# <= 1 )) || die 'Передайте только имя ветки.'
  local branch=${1:-main}
  local app_dir=${APP_DIR:-/opt/nocapgym}
  api_service=${API_SERVICE:-nocapgym-api}
  local health_url=${HEALTH_URL:-http://127.0.0.1:4000/api/health}
  local tool git_dir target_commit nvm_script

  for tool in git flock sudo systemctl sqlite3 curl; do
    command -v "$tool" >/dev/null || die "Не найдена команда $tool."
  done
  git check-ref-format "refs/heads/$branch" >/dev/null || die 'Некорректное имя ветки.'
  [[ "$branch" != -* ]] || die 'Имя ветки не может начинаться с дефиса.'
  cd "$app_dir"
  [[ "$(git rev-parse --show-toplevel)" == "$(pwd -P)" ]] || die 'APP_DIR должен указывать на корень репозитория.'
  git_dir=$(git rev-parse --absolute-git-dir)
  exec 9>"$git_dir/nocapgym-deploy.lock"
  flock -n 9 || die 'Другое обновление уже выполняется.'
  [[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die 'В репозитории есть незакоммиченные файлы. Сохраните изменения перед обновлением.'

  # nvm is a shell function and is usually absent in non-interactive shells.
  nvm_script=${NVM_DIR:-$HOME/.nvm}/nvm.sh
  if [[ -s "$nvm_script" ]]; then
    set +u
    source "$nvm_script" --no-use
    nvm use 22
    set -u
  fi
  command -v node >/dev/null || die 'Нужен Node.js 22.12 или новее в пределах версии 22.'
  command -v npm >/dev/null || die 'Не найден npm.'
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 22 || minor < 12) process.exit(1)' || die 'Нужен Node.js >=22.12 и <23.'
  sudo -v

  previous_commit=$(git rev-parse HEAD)
  git fetch --no-tags origin "refs/heads/$branch"
  target_commit=$(git rev-parse 'FETCH_HEAD^{commit}')
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git merge-base --is-ancestor "$branch" "$target_commit" || die 'Локальная ветка содержит коммиты, отсутствующие в origin. Автоматическая перезапись запрещена.'
  fi
  printf 'Ветка: %s\nПредыдущий коммит: %s\nНовый коммит: %s\n' "$branch" "$previous_commit" "$target_commit"
  printf 'previous_commit=%s\ntarget_commit=%s\nbranch=%s\n' "$previous_commit" "$target_commit" "$branch" >"$git_dir/nocapgym-deploy-state"

  trap on_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  service_touched=true
  sudo systemctl stop "$api_service"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git switch "$branch"
    git merge --ff-only "$target_commit"
  else
    git switch --no-track --create "$branch" "$target_commit"
  fi

  npm ci --include=dev
  npm run prisma:generate
  npm run lint
  npm run typecheck
  npm test
  npm run build
  npm run prisma:migrate:deploy
  sudo systemctl start "$api_service"
  curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused \
    --connect-timeout 3 --max-time 5 --retry-max-time 45 "$health_url"
  sudo systemctl is-active --quiet "$api_service"
  sudo systemctl status "$api_service" --no-pager
  printf '\nОбновление завершено: %s (%s).\n' "$branch" "$target_commit"
}

# Load the entire function before checkout: older branches may lack this file.
main "$@"
