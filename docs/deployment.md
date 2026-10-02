# Live deployment checklist

The repository is deployable; deploying it still requires the server, domain, SSH access and approval for that destination. These files have not provisioned a live server or certificates.

## Docker + MariaDB

1. Install Docker with Compose on the server, point your ad-server domain's DNS to it, and clone this repository into a private application directory.
2. Create `.env` (mode 600). Set `APP_URL=https://ads.your-domain.com` (no trailing slash), a strong `ADMIN_PASSWORD`, independent random `DELIVERY_SECRET` (at least 32 bytes), `DB_PASSWORD` and `DB_ROOT_PASSWORD`. Generate secrets locally with `openssl rand -hex 32`; never commit them. No seed/default admin account is created.
3. Run `docker compose build`, then `docker compose up -d`. The migration service applies all five migrations before app startup. MariaDB is not published; the app binds only to server loopback.
4. Obtain a trusted TLS certificate using your hosting panel or ACME client. Adapt `deploy/nginx.conf.example`, run `nginx -t`, then reload Nginx. Do not enable `TRUST_PROXY=true` with a directly reachable app port or a proxy that forwards a client-supplied X-Real-IP.
5. Check `docker compose ps`, `docker compose logs --tail=100 app migrate` and the HTTPS `/api/health` endpoint. Configure your existing external monitor to alert when it does not return HTTP 200. Container health alone does not send alerts or restart an unhealthy process.
6. Sign in, upload a creative, assign the campaign to a placement, publish its tag on a test website and test the JSON endpoint from an app. Confirm image load, one impression, redirect, no duplicate event on replay, pause, daily cap, and no-fill behavior before enabling real campaigns.

For each upgrade: take a backup, pull the reviewed commit, run `docker compose build`, `docker compose run --rm migrate`, then `docker compose up -d app`. Migrations are forward-only; reverting application code does not revert schema. Never use `docker compose down -v` on live data.

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
