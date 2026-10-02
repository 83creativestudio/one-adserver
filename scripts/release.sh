#!/usr/bin/env bash
set -Eeuo pipefail

# Commit, push and deploy ONE. Adserver to its existing ONE Control site.
# Use --yes only when every file shown by git status is intended for the commit.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
remote=${ADSERVER_DEPLOY_SSH:-root@49.13.84.162}
site_root=/var/www/one-control-sites/adserver.onedigital.com.cy
domain=https://adserver.onedigital.com.cy
yes=false
if [[ ${1:-} == '--yes' ]]; then yes=true; shift; fi
if (( $# != 1 )) || [[ -z $1 ]]; then
  printf 'Usage: %s [--yes] "commit message"\n' "$0" >&2
  exit 2
fi
message=$1
if [[ ! $remote =~ ^[A-Za-z0-9][A-Za-z0-9._@-]*$ ]]; then
  printf 'ADSERVER_DEPLOY_SSH must be an SSH alias or user@host.\n' >&2
  exit 2
fi
if [[ $(git branch --show-current) != main ]]; then printf 'Run releases from main.\n' >&2; exit 1; fi
origin=$(git remote get-url origin)
if [[ $origin != https://github.com/83creativestudio/one-adserver.git && $origin != git@github.com:83creativestudio/one-adserver.git ]]; then
  printf 'Git origin does not point to 83creativestudio/one-adserver.\n' >&2
  exit 1
fi

printf 'Checking the target server...\n'
ssh -o BatchMode=yes -o ConnectTimeout=10 "$remote" bash -s -- "$site_root" <<'REMOTE_PREFLIGHT'
set -Eeuo pipefail
site_root=$1
test -d "$site_root/public"
test -f /etc/nginx/conf.d/one-control/adserver.onedigital.com.cy.conf
test -f /etc/letsencrypt/live/adserver.onedigital.com.cy/fullchain.pem
for program in git docker curl nginx openssl flock; do command -v "$program" >/dev/null; done
docker compose version >/dev/null
if [[ -d $site_root/app ]]; then
  test -d "$site_root/app/.git"
  test "$(git -C "$site_root/app" branch --show-current)" = main
  test -z "$(git -C "$site_root/app" status --porcelain)"
fi
REMOTE_PREFLIGHT

printf 'Running release checks...\n'
npm test
npm run typecheck -- --incremental false

printf '\nFiles included by git add -A:\n'
git status --short
if [[ -n $(git status --porcelain) ]]; then
  if [[ $yes != true ]]; then
    if [[ ! -t 0 ]]; then printf 'Use --yes for noninteractive releases.\n' >&2; exit 2; fi
    read -r -p 'Commit these files, push main and deploy? [y/N] ' answer
    if [[ $answer != y && $answer != Y ]]; then printf 'Release cancelled.\n'; exit 1; fi
  fi
  git add -A
  git diff --cached --check
  git commit -m "$message"
else
  printf 'No uncommitted changes; releasing the current commit.\n'
fi

commit=$(git rev-parse HEAD)
git push origin main
printf 'Deploying %s to %s...\n' "$commit" "$domain"
ssh -o BatchMode=yes "$remote" bash -s -- "$site_root" "$commit" "$domain" <<'REMOTE_DEPLOY'
set -Eeuo pipefail
site_root=$1
commit=$2
domain=$3
app_dir=$site_root/app
nginx_site=/etc/nginx/conf.d/one-control/adserver.onedigital.com.cy.conf
umask 077
mkdir -p "$site_root/backups" "$site_root/private"
exec 9> "$site_root/private/.adserver-deploy.lock"
flock -n 9 || { printf 'Another adserver deployment is running.\n' >&2; exit 1; }

if [[ ! -d $app_dir ]]; then
  git clone --branch main https://github.com/83creativestudio/one-adserver.git "$app_dir"
fi
cd "$app_dir"
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
git fetch origin main
test "$(git rev-parse origin/main)" = "$commit"

# Initial credentials remain on the server. The administrator password is
# written once to the site's private directory for the owner to retrieve.
if [[ ! -f .env ]]; then
  test ! -e "$site_root/private/adserver-admin-password"
  admin_password=$(openssl rand -hex 24)
  db_password=$(openssl rand -hex 32)
  root_password=$(openssl rand -hex 32)
  delivery_secret=$(openssl rand -hex 32)
  printf '%s\n' "$admin_password" > "$site_root/private/adserver-admin-password"
  chmod 600 "$site_root/private/adserver-admin-password"
  {
    printf 'APP_URL=%s\n' "$domain"
    printf 'ADSERVER_HOST_PORT=3017\n'
    printf 'ADMIN_PASSWORD=%s\n' "$admin_password"
    printf 'DELIVERY_SECRET=%s\n' "$delivery_secret"
    printf 'DB_PASSWORD=%s\n' "$db_password"
    printf 'DB_ROOT_PASSWORD=%s\n' "$root_password"
  } > .env
  chmod 600 .env
  unset admin_password db_password root_password delivery_secret
  printf 'Initial credentials saved in %s/private/ (mode 600).\n' "$site_root"
fi
grep -Fxq "APP_URL=$domain" .env
grep -Fxq 'ADSERVER_HOST_PORT=3017' .env
docker compose config --quiet

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir=$site_root/backups/$timestamp-${commit:0:12}
mkdir -m 700 -- "$backup_dir"
if docker compose ps --status running --services | grep -Fxq db; then
  docker compose exec -T db sh -c 'exec mariadb-dump --single-transaction --user=root --password="$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > "$backup_dir/database.sql"
  if docker compose ps --status running --services | grep -Fxq app; then
    docker compose exec -T app tar -C /app/data -czf - uploads > "$backup_dir/uploads.tar.gz"
  else
    docker compose run --rm --no-deps --entrypoint tar app -C /app/data -czf - uploads > "$backup_dir/uploads.tar.gz"
  fi
  printf 'Database and uploads backed up to %s\n' "$backup_dir"
fi

git merge --ff-only "$commit"
docker compose build migrate
docker compose up -d db
docker compose run --rm migrate
docker compose up -d --no-deps app
curl --fail --silent --show-error --retry 12 --retry-delay 5 --max-time 10 http://127.0.0.1:3017/api/health >/dev/null

# Preserve the ONE Control vhost for recovery before changing its routing.
cp -a "$nginx_site" "$backup_dir/nginx.conf.before-release"
install -m 644 deploy/nginx.conf.example "$nginx_site"
if ! nginx -t || ! systemctl reload nginx; then
  cp -a "$backup_dir/nginx.conf.before-release" "$nginx_site"
  nginx -t && systemctl reload nginx
  printf 'Nginx configuration failed; the previous vhost was restored.\n' >&2
  exit 1
fi
if ! curl --fail --silent --show-error --retry 6 --retry-delay 5 --max-time 10 "$domain/api/health" >/dev/null; then
  cp -a "$backup_dir/nginx.conf.before-release" "$nginx_site"
  nginx -t && systemctl reload nginx
  printf 'Public health check failed; the previous vhost was restored.\n' >&2
  exit 1
fi
printf 'Deployment healthy: %s (%s)\n' "$domain" "$commit"
REMOTE_DEPLOY
