# Property Management Platform

A working, database-backed UK property management application in the **Landlord** repository. The product name is temporary. This is a substantial SaaS foundation with tested core journeys; it is **not the entire 45-part brief or a launch-approved commercial product**. See [implementation status](docs/IMPLEMENTATION.md) for the exact boundary.

Next.js 16 App Router · React 19 · strict TypeScript · Tailwind 4 · Lucide · PostgreSQL · Prisma 7 · Better Auth · Stripe Billing · Resend · private S3-compatible storage · Vitest · Playwright.

No AI chatbot, assistant or contractor-facing system is included.

## Start locally

Use Node.js 24, npm and Docker Compose. PostgreSQL 17 is the supplied development database.

```sh
npm ci
cp .env.example .env
```

Set a random local database password, a random authentication secret (at least 32 characters) and a separate random job secret in `.env`. Generate secrets locally with `node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'`. Never commit `.env`.

Set `POSTGRES_PASSWORD` in your shell to the same password used in `DATABASE_URL`, then:

```sh
docker compose up -d
npm run db:generate
npm run db:migrate
NODE_ENV=development npm run db:seed
npm run dev
```

Open **http://localhost:3000**. Registration is available at `/register`. The landlord and tenant portals share `/app`, with navigation and access based on authenticated organisation membership.

The development seed creates separate landlord and tenant accounts, an unrelated organisation, properties, room tenancies, partial rent payments, private and shared repairs, certificates, tasks, an inventory, expenses and a real generated PDF. Unique development credentials are written to **`.dev-accounts.json`**, ignored by Git and restricted to mode 0600. Seeding is refused in production. Re-running it preserves the existing development dataset.

No paid credentials are required locally. The sample subscription is explicitly development-only and rejected in production. Uploaded development files live in ignored `storage/`, outside the public directory.

## Email in development

Verification, password reset and invitations are queued to a PostgreSQL outbox. Without a Resend key, the worker retains them as local messages rather than pretending to send email.

```sh
npm run jobs
npm run mail:preview -- the-generated-account-email@example.test
```

The second command intentionally shows the specified development account's private links **locally**; do not paste its output into issues, logs or shared channels. It is disabled in production. Open the verification link to activate a newly registered account. Invited tenants register with the exact invited email, verify it and accept the invitation.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Integration tests require a separate database whose name ends in `_test`. The runner refuses another database.

```sh
npm run test:setup
docker compose exec postgres createdb -U platform platform_test
node --env-file=.env.test node_modules/prisma/build/index.js migrate deploy
npm run test:integration
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts/reuses the local development server and uses the development seed. Tests create additional development records. It checks registration/verification/onboarding, landlord property/tenant/tenancy/payment creation, tenant invitation activation, tenant repair reporting with a photograph, repair conversation and resolution, private repair UI and direct API denial, selective sharing/revocation, property record and room updates, tenant preferences, repair feedback and responses, document expiry/previews, printable payment receipts, private deposit proposal responses and mobile navigation.

The CI workflow repeats type, lint, unit, database, browser, build and dependency checks with disposable PostgreSQL data. CI credentials are disposable examples, not production accounts.

## Configuration and integrations

- Branding: `src/lib/config.ts`, `NEXT_PUBLIC_PRODUCT_NAME`, `NEXT_PUBLIC_ACCENT`, `public/icon.svg`. Public variables are build-time configuration; rebuild after changing them. Support/company information and all transactional subjects use central branding. Some neutral prose and document headings should also be reviewed when introducing permanent branding.
- SaaS billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; configure production plans and real Stripe price IDs in the protected administration area. Webhook: `/api/webhooks/stripe`. Tenant rent collection is separate and disabled.
- Email: `RESEND_API_KEY`, `EMAIL_FROM`; run the job worker regularly.
- Files: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, credentials and optional `S3_ENDPOINT`. Private buckets only; downloads pass through an authenticated, authorised, no-cache endpoint.
- Other provider capabilities: typed adapters return explicit unconfigured results. No e-signatures, portal publishing, credit checks, bank connections, tax submissions or credit reporting are claimed.

See [integration setup](docs/INTEGRATIONS.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [deployment](docs/DEPLOYMENT.md) and [implementation status](docs/IMPLEMENTATION.md).

## Administration

Register and verify a normal account, enable two-factor authentication at `/account/security` (also available from Settings), then an authorised infrastructure operator may run:

```sh
npm run admin:grant -- your-existing-verified-email
```

This grants database-backed platform administrator access and records an audit event. Production administration requires enabled two-factor authentication. `/admin` exposes operational metadata, plans, reviewed compliance rules, job failures and audits; it has no interface for browsing tenant messages or sensitive documents.

## Background work

`npm run jobs` performs one scheduling/delivery batch. Use a supervised scheduled runner, at least every minute for email and daily for schedule generation. Every rent schedule, reminder, recurring task and queued email has a deduplication key. Workers claim jobs atomically, retry failures with backoff and recover stale locks. Access to repair/document notifications is rechecked before delivery. Do not run the worker against real recipients until email configuration and operational policy are approved.

## Repository delivery

All source, migrations, tests, local setup and deployment documentation are committed. No secrets, uploaded files, generated accounts, runtime database contents or browser traces are committed. Deployments are operator-managed. This repository does not provision paid services or process tenant funds.
