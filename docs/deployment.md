# Live deployment checklist

The production domain is `https://adserver.onedigital.com.cy/`. The repository includes a repeatable release script for an existing Docker Compose installation. Initial server provisioning, DNS and TLS certificate setup still require server access.

## One-command releases

Run this in the local repository:

```sh
./scripts/release.sh "Describe this release"
```

The default SSH target is `root@49.13.84.162`, the host used for the other ONE Control deployments. Override it with `ADSERVER_DEPLOY_SSH=user@host` if the server changes. The script runs local tests and TypeScript checking, shows all pending files for confirmation, commits and pushes `main`, deploys the exact pushed commit, backs up a running database and uploads, builds the containers, migrates, starts the app, switches the domain's Nginx vhost and checks the public health endpoint. Use `--yes` before the commit message only for an unattended release where all pending files should be committed.

The source, database and secrets live under `/var/www/one-control-sites/adserver.onedigital.com.cy/app`, outside the site's `public` directory. Nginx serves the domain by proxying to the app on loopback port 3017; `public` remains the ONE Control document root and ACME challenge path. Keeping the application outside `public` prevents a future static web-server configuration from serving its `.env`, source or database files.

On the first release the script clones the repository and generates independent server-only credentials. The initial administrator password is stored at `/var/www/one-control-sites/adserver.onedigital.com.cy/private/adserver-admin-password` with mode 600; retrieve it over SSH and keep it in your password manager. Sign in with username `admin` and that password. The first successful login creates the database-backed `admin` account. Subsequent logins require a username and password; the server `ADMIN_PASSWORD` is no longer an alternate login after the first account exists. In the dashboard, use **Users** to add administrators or update usernames and passwords. A password change invalidates that user's existing sessions. Later releases preserve credentials and Docker volumes. The script backs up both MariaDB and uploads under the site's `backups` directory when there is a running database; arrange an off-server backup copy and retention policy. If a health check fails, inspect `docker compose logs app migrate` and the Nginx error log.

## Docker + MariaDB

1. The observed ONE Control server has Docker Compose, a trusted certificate, DNS and a static placeholder vhost already configured. The release script handles the application setup and vhost switch.
2. For a manual setup, clone the repository under the site's `app` directory and create `.env` (mode 600) with `APP_URL=https://adserver.onedigital.com.cy`, `ADSERVER_HOST_PORT=3017`, a strong `ADMIN_PASSWORD`, independent random `DELIVERY_SECRET`, `DB_PASSWORD` and `DB_ROOT_PASSWORD`. Never commit them.
3. Run `docker compose build migrate`, `docker compose up -d db`, `docker compose run --rm migrate`, and `docker compose up -d --no-deps app`. MariaDB is not published; the app binds only to server loopback.
4. Use `deploy/nginx.conf.example` for the existing domain, run `nginx -t`, then reload Nginx. Do not enable `TRUST_PROXY=true` with a directly reachable app port or a proxy that forwards a client-supplied X-Real-IP.
5. Check `docker compose ps`, `docker compose logs --tail=100 app migrate` and the HTTPS `/api/health` endpoint. Configure your existing external monitor to alert when it does not return HTTP 200. Container health alone does not send alerts or restart an unhealthy process.
6. Sign in, upload a creative, assign the campaign to a placement, publish its tag on a test website and test the JSON endpoint from an app. Confirm image load, one impression, redirect, no duplicate event on replay, pause, daily cap, and no-fill behavior before enabling real campaigns.

For each upgrade use the release script or take a backup, pull the reviewed commit, build the image, migrate and restart the app. Migrations are forward-only; reverting application code does not revert schema. Never use `docker compose down -v` on live data.

## Backups and recovery

Back up **both** MariaDB and the uploads volume; store encrypted copies off-server with retention and test restores. Example commands from the repository directory (the environment variable is expanded inside the database container):

```sh
docker compose exec -T db sh -c 'mariadb-dump --single-transaction --user=root --password="$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > database-backup.sql
docker compose exec -T app tar -C /app/data -czf - uploads > uploads-backup.tar.gz
```

Use a private backup directory and restrictive umask. For a coordinated snapshot, stop the app during both commands (use `docker compose run --rm --no-deps app` instead of `exec app` for the archive). Schedule these commands in your server's backup system; the repository does not install a schedule automatically. Avoid uploads cleanup until a retention policy is configured.

Restore into a **separate** MariaDB database and uploads volume first, import the SQL using `mariadb`, extract the archive into `/app/data`, run migrations, and verify `/api/health`, admin login, image URLs and reporting before switching traffic. Keep the prior volumes intact. Document and test recovery time before launch.

## Non-Docker hosting

Use Node 22.17+; `npm ci`, configure `.env.local`, `npm run db:migrate`, `npm run build`, `npm start`. Configure a process supervisor, HTTPS reverse proxy, persistent upload directory owned by the application user and private MariaDB connectivity. Set `DB_PROVIDER=mariadb`; see `.env.example`. Keep port 3000 private. SQLite is intended for local development, not multi-host deployment.

## Delivery semantics and remaining scale limits

- Campaigns serve only assigned placements with matching creative dimensions. Existing campaigns must be assigned after upgrade; no automatic broad assignment is made.
- Days and pacing use UTC. Even pacing gradually releases a capped day's allowance, starting with one impression. Zero cap means unlimited.
- Each fill reserves an impression for five minutes or until UTC midnight. Only image-load confirmation within that window counts. Failed/blocked loads release capacity at expiry. This measures image loads, not viewability or fraud-free human impressions.
- A signed request counts at most one impression and one click. Click redirects expire after 24 hours. Existing pre-upgrade tracking links stop working.
- Website tags and the JSON app API are supported. This is not yet a native SDK, VAST/video server, auction/RTB platform, billing platform or multi-tenant ad exchange.
- Sessions last eight hours, are revoked on logout, and invalidate after password/secret changes. The account menu can revoke every session. Login throttling persists in the database.
- Event/request history is retained. Before high-volume operation, define retention/aggregation, load-test expected traffic, add traffic abuse controls and validate backup/monitor alerts. External image URLs must remain available over HTTPS for HTTPS publishers.
