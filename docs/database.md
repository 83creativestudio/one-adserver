# Database setup

The same application code supports SQLite and MariaDB. All administration, ad selection, event tracking, and report queries use `database/index.mjs`. Queries use bound parameters. UUIDs identify records; timestamps use UTC ISO 8601 strings so both providers return the same API values.

## Localhost: SQLite

Set these in `.env.local` (or keep the defaults):

```dotenv
DB_PROVIDER=sqlite
DATABASE_PATH=data/one-adserver.sqlite
```

Run `npm run db:init`. This creates the file, applies pending migrations, and records their checksums. SQLite also initializes on first use for local convenience. WAL mode, foreign keys, and a five-second busy timeout are enabled. Existing installations with the original six tables are adopted without deleting their records; missing tables and indexes are added.

## Live server: MariaDB

Use a maintained MariaDB release (10.11 or later). Integration tests have been run against MariaDB 12.3.2 with strict SQL mode and `ONLY_FULL_GROUP_BY` enabled.

Provision the database using your server's administrator account. Replace the example password and choose a host restriction suitable for the application server:

```sql
CREATE DATABASE one_adserver CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'one_adserver'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON one_adserver.* TO 'one_adserver'@'localhost';
```

Configure the server environment:

```dotenv
DB_PROVIDER=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=one_adserver
DB_USER=one_adserver
DB_PASSWORD=your-password
DB_POOL_SIZE=10
ADMIN_PASSWORD=your-admin-password
DELIVERY_SECRET=your-delivery-secret
```

For a remote database, set `DB_SSL=true`. Set `DB_SSL_CA` to the trusted CA PEM file when needed. Certificate verification remains enabled. A local Unix socket can be selected with `DB_SOCKET`. The app does not silently fall back to SQLite if MariaDB is unavailable or misconfigured.

Run these from the project directory:

```bash
NODE_ENV=production npm run db:migrate
npm run build
npm start
```

The CLI loads Next.js environment files, including `.env.local`; system environment variables take precedence. Keep local SQLite configuration off the live server, or explicitly set `DB_PROVIDER=mariadb` in the server environment. A separate migration account can hold DDL permissions; the runtime account only needs SELECT, INSERT, UPDATE, and DELETE after migration.

## Tables

| Table | Saved data | Relationships |
| --- | --- | --- |
| `advertisers` | Company name, contact email, creation date | Parent of campaigns |
| `properties` | Website/app name, type, domain or app ID | Parent of placements |
| `placements` | Property, name, pixel dimensions | Belongs to a property |
| `campaigns` | Advertiser, name, status, flight dates, daily cap, priority | Belongs to an advertiser |
| `creatives` | Campaign, name, image URL, destination URL, dimensions | Belongs to a campaign |
| `events` | Request, impression or click, related IDs, timestamp | Historical records retained after parent deletion |
| `schema_migrations` | Applied migration version, checksum, timestamp | Tracks schema changes |

Deleting a property cascades to its placements. Deleting an advertiser cascades to its campaigns and creatives. Events intentionally have no foreign key cascade so historical delivery totals survive these deletions. Indexes cover relationships, campaign status, creative dimensions, and event time/campaign/placement/creative lookups. User passwords remain environment configuration; this release has one administrator and does not implement database user accounts.

## Migrations and deployment files

Provider-specific SQL is in `database/migrations/sqlite` and `database/migrations/mariadb`. Each numbered file is applied once. Applied migration checksums are verified; change the schema by adding a new migration, not editing one already applied.

SQLite runs migrations in a transaction. MariaDB uses an advisory lock because DDL commits implicitly; migration statements are idempotent so interrupted setup can be rerun. Run migrations once as a deployment step before starting application processes. Include the `database/` directory in the deployed app and run commands from the project root. A database backup remains necessary before future schema changes.

Changing `DB_PROVIDER` selects another database; it does not transfer local records to the live database. No live server has been modified by this setup.

## Verification

`npm run db:test` creates temporary SQLite databases and checks CRUD, relationships, numeric reporting, Unicode, reconnect persistence, repeat migrations, and adoption of the original schema. It never uses the local application database.

Run the same tests against an isolated MariaDB database with:

```bash
TEST_DB_PROVIDER=mariadb DB_NAME=one_adserver_test_backend DB_USER=test_user \
  DB_PASSWORD=your-test-password DB_HOST=127.0.0.1 npm run db:test
```

MariaDB tests require a database name beginning `one_adserver_test_`. Use a disposable database with only test records. The HTTP smoke test in `scripts/smoke.mjs` separately checks the complete serving flow against a running app.
