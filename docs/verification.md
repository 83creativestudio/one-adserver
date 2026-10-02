# Release verification

Verified locally during this implementation:

- Seven automated tests pass on SQLite and on an isolated MariaDB 12.3.2 instance with strict SQL modes. Coverage includes migration repeatability and legacy adoption, CRUD/relationships, explicit placement isolation, 20 concurrent delivery requests against a cap of three, reservation expiry/reuse, pacing, deduplicated impressions/clicks, sessions/revocation/expiry, concurrent login throttling, image validation, and publisher-tag image-load timing.
- TypeScript checking and the production build pass with Next.js 16.3.8.
- HTTP smoke tests pass on the production build with SQLite: login, CRUD/edit, image upload/retrieval, delivery, impression/click replay, metrics, unauthorized requests and logout revocation. `/api/health` returns 200.
- `npm audit fix` completed with zero reported vulnerabilities across 471 audited packages at the time of verification. Keep the lockfile and rerun audit before deployment.

Not yet verified: live server deployment, TLS certificates, off-server backup/restore and alert delivery, real publisher/native app acceptance, load capacity, and the Docker Compose stack (Docker is not installed on the development machine). The in-app browser blocked the localhost preview, so this release has not received a visual browser review. The automated tag test does not replace a real-browser integration test.

Run smoke tests only on disposable test databases: test campaign/inventory records are removed, but uploaded assets and delivery history are retained.
