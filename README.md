# ONE. Adserver

A self-hosted Next.js ad server built on the supplied Modernize TypeScript starter kit. It provides a responsive operator dashboard, website and app inventory, campaigns, image creatives, a website tag, a JSON delivery API, and live request, impression, and click reports. SQLite is the default for localhost; MariaDB is supported for the live server.

## Run locally

Requires Node.js 22.17 or newer and npm. SQLite uses Node's built-in `node:sqlite` module, which is experimental in Node 22.

```bash
npm ci
cp .env.example .env.local
npm run db:init
npm run dev
```

Set a strong `ADMIN_PASSWORD` in `.env.local` before testing the sign-in flow. Open [http://localhost:3000](http://localhost:3000). In development only, leaving `ADMIN_PASSWORD` unset allows local access; production requires it.

Local data is stored in `data/one-adserver.sqlite`. Schema migrations preserve existing records. Use SQLite's online backup mechanism, or stop the app and back up the database with its WAL companions.

## MariaDB for the live server

Create a MariaDB database and dedicated user, set `DB_PROVIDER=mariadb`, and configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Then run `npm run db:migrate` before `npm run build` and `npm start`. Credentials come from environment variables; the runtime uses a connection pool and does not create tables with its regular application queries.

See [database setup and schema](docs/database.md) for provisioning, TLS, the table relationships, migration behavior, and verification commands. Switching providers does not copy records between databases.

## Set up a campaign

1. Add an advertiser.
2. Add a website or app, then a placement with a width and height.
3. Create an active campaign for the advertiser.
4. Add an image creative to that campaign with the same width and height as the placement, plus an HTTPS destination URL.
5. Copy the website tag from Placements, or call the JSON endpoint from an app.

Website tag:

```html
<div data-one-placement="PLACEMENT_ID"></div>
<script async src="https://YOUR_ADSERVER_HOST/ad.js"></script>
```

App delivery request:

```http
GET https://YOUR_ADSERVER_HOST/api/serve?placement=PLACEMENT_ID
```

The JSON response includes the image URL, click URL, impression URL, and dimensions. For native apps, render the image, request the impression URL only after the image is shown, and open the click URL after a tap. An empty placement returns `{ "ad": null }`.

## Delivery rules and security

Eligible creatives must match the placement dimensions. Campaigns must be active, inside their optional start/end dates, and under the daily impression cap. Eligible creatives are selected randomly with weights from their campaign priority (1–10). Reports read the event store immediately; there is no hourly reporting delay.

The admin API and dashboard require the admin session when `ADMIN_PASSWORD` is set. Public delivery URLs contain a signed, 24-hour token that links impression and click events to a served creative. Set `DELIVERY_SECRET` to a distinct, long random value in production. Keep both secrets off Git. Run behind HTTPS and a reverse proxy with appropriate request limits.

This is an initial test release. SQLite supports local testing; MariaDB provides server database storage. The serving logic has not yet been validated for distributed high-volume delivery. The app does not yet include multi-user roles, video/VAST, geo or frequency targeting, billing, or fraud detection.

## Checks

```bash
npm run typecheck
npm run db:test
npm run build
SMOKE_PASSWORD=your-local-password node scripts/smoke.mjs
```

The smoke check assumes a running local server at `http://127.0.0.1:3107` unless `SMOKE_BASE` is set. It creates and removes a test campaign. Its request, impression, and click events remain in the local database as historical events.
