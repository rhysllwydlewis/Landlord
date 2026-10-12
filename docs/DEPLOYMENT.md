# Local and production deployment

No deployment, paid resource activation or real-money processing was performed during this build.

## Production prerequisites

Choose a Node.js host (Node 24), private PostgreSQL 17+ and private S3-compatible bucket. Prepare HTTPS, a verified email sender, Stripe account/plans, backups and a supervised scheduled worker. Complete legal/security reviews and the unfinished workflows in `IMPLEMENTATION.md`. Set environment variables through a secret manager; never bake runtime secrets into the image or repository.

`npm run verify:env` checks required variable formats without exposing values. Passing it does not establish provider access or launch readiness. It deliberately rejects local storage and HTTP production URLs. External provider permissions and operational status must be tested separately.

## Build and release

```sh
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
# Release-stage job against the intended production database:
npm run db:migrate
NODE_ENV=production npm start
```

Do not run `prisma migrate dev` or a seed on production. Restart the development server after regenerating Prisma on schema changes; an old hot-reloaded database singleton can retain the prior model definition.

The Dockerfile provides a build and a non-root runtime. It includes the job/migration tooling so the same image can run controlled release and scheduled worker commands. Build-time public branding arguments are non-secret. The build database URL is a nonfunctional placeholder, because public listing queries are request-time dynamic. Configure genuine runtime variables externally.

The production Dockerfile uses standard `RUN` instructions and strict TLS validation. It intentionally contains no BuildKit secret mounts: some hosted builders, including the Railway builder that reported this failure, reject mount types other than caches. Normal hosts use their trusted system certificates.

In a certificate-proxied development environment, use a temporary verification-only Dockerfile that mounts the provided CA on the dependency-install step, with `NODE_EXTRA_CA_CERTS` set for that step. Keep the production Dockerfile portable and do not copy proxy certificates into image layers or disable TLS validation.

## Railway configuration

Use the repository root and the root `Dockerfile`. Keep the image's `npm start` command; Next.js listens on `0.0.0.0` and honours Railway's runtime `PORT`. Set `APP_URL` and `BETTER_AUTH_URL` to the actual HTTPS application origin, provide a generated `BETTER_AUTH_SECRET` (at least 32 random characters), and set `DATABASE_URL` from the intended PostgreSQL service. Configure email, storage and billing separately as described in `INTEGRATIONS.md`.

Use `npm run db:migrate` as a controlled pre-deploy command against that database. Do not seed production. Runtime credentials belong in service variables, not Docker build arguments. Public branding arguments are fixed at build time, so changes require rebuilding the image.

Validate the container locally before release:

```sh
docker build --tag property-management-platform:check .
node scripts/check-container.mjs
```

The smoke check uses an ephemeral container bound only to localhost, a generated disposable authentication secret and an intentionally unavailable database. It checks the configured port, the homepage, the non-root runtime, excluded private files and denial of anonymous workspace access. It does not connect a real database or provider, run migrations, or verify a deployed Railway service. GitHub CI also builds the unmodified production Dockerfile and runs this check.

## Scheduled jobs

Run `npm run jobs` at least every minute for queued email. The scheduler also generates rent obligations, compliance/rent/task reminders and tasks from reviewed rules. Unique keys make repeated runs idempotent. Supervise failures and alert on failed jobs, stale locks and accumulating queued messages. Schedule timing/preferences are not a complete automation configuration product yet.

The optional `/api/jobs/run` endpoint accepts only a constant-time checked Bearer `JOB_SECRET` (at least 32 random characters) and is rate limited. It is disabled when the secret is missing. Prefer the supervised CLI runner for large portfolios. `/api/health` reports database availability without exposing configuration.

Use one initially; concurrent claiming is protected, but verify throughput and provider idempotency behaviour before scaling. Use UTC consistently. The current workspace defaults to UK formatting/GBP; full per-organisation timezones are unfinished.

## Database and storage backups

Use encrypted daily backups plus point-in-time recovery/WAL for PostgreSQL, private object versioning/lifecycle policies, separate least-privilege backup credentials and documented restore targets. Run a restore drill to an isolated environment before launch and on a regular schedule.

Do not export live databases to developer laptops or use real customer data in seeds. Match backup/retention windows to reviewed privacy and financial/evidence obligations. Restore database and object versions consistently so document metadata does not reference missing files.

## Operational access and rollout

Register/verify the bootstrap administrator, enable TOTP, then use the audited infrastructure `admin:grant` command. Review production plans, price IDs and source-backed rules; development samples do not grant production entitlements. Enable providers only after test-mode verification. Establish support contacts, incident response, email failure monitoring and account suspension procedures.

The site must remain unpublished until the owner authorises deployment and the outstanding launch requirements are addressed. This documentation is a deployment workflow, not proof of a completed launch.
