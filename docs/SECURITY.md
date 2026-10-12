# Security and privacy

## Enforced controls

- Better Auth owns password hashing, signed secure sessions, verification/reset tokens, authenticator checks and lockouts. Password reset revokes existing sessions. Production cookies are Secure, HttpOnly and SameSite.
- Request handlers authenticate verified accounts and active organisation membership. IDs never substitute for organisation checks. Staff write permissions differ from read permissions; tenants cannot write payments or change tenancy status.
- Shared client forms keep native fields disabled and the form inert until hydration and declare POST, preventing a native GET submission from putting passwords or record values in URLs. A JavaScript-disabled state explains the requirement.
- Mutations check the configured request Origin and reject cross-site requests. Better Auth applies its own origin/CSRF protection. Authentication and application endpoints use database-backed rate limits; development authentication thresholds are higher for repeatable local testing.
- Repair and document permissions are enforced in SQL predicates, response projections and downloads. Private notes, comments, costs and attachments are excluded from tenant responses. Read-only owners need explicit financial/document permission and selected property access.
- React renders user content as text. No uploaded HTML/SVG or raw user HTML is executed. Uploads allow PDF/PNG/JPEG/WebP, verify content signatures, enforce 10 MB/file and plan storage limits, store random object keys outside public storage, and use authenticated no-cache downloads.
- Money is integer pence. Composite organisation foreign keys, amount/date constraints and deferred allocation integrity triggers enforce relational and financial bounds. Financial mutations and imports use transactions.
- Visibility, financial, membership, administration and export actions are audited. Super-admin views contain operational metadata, not private tenant conversation/document content.
- Stripe signatures and processed event IDs protect subscription webhooks. Development billing/local file storage cannot be used in production. No online tenant payment success is simulated.
- Secrets, seed credentials, uploaded files and test traces are ignored. Request logging is disabled to keep verification links out of development logs. Errors avoid printing request bodies/provider secrets.

## Before real customer data

The security controls above have automated regression coverage, but this is not an independent security assessment. Complete the unfinished-work list and arrange external review before launch.

Production infrastructure must enforce HTTPS/HSTS, trusted proxy forwarding, request-body limits (12 MB for uploads, smaller JSON limits), encrypted database/object storage, private buckets, least-privilege service credentials and encrypted backups. Do not expose PostgreSQL or the development email outbox. The application streams authorised files rather than exposing permanent public URLs.

The current CSP excludes framing and object execution, restricts sources to the same origin, and permits Next.js inline scripts/styles. Development alone permits eval for React tooling. A stricter nonce-based production CSP and formal accessibility/security tests remain launch review tasks.

PDF signature checks do not replace malware scanning. Add quarantine/scanning before accepting files from untrusted real customers. Outbox verification/invitation tokens are private database content: restrict operational access and expire/purge old transactional payloads appropriately. Provider idempotency windows and exact delivery guarantees must be reviewed with the chosen service; retries do not claim magical exactly-once network delivery.

## Data rights and retention

The app records account deletion requests and enquiry consent/retention dates. Optional passport exports require selective sharing and consent. Organisation exports are permission-controlled and audited. These do not constitute a complete GDPR rights-management system.

Define the controller, lawful bases, processor contracts, retention periods by record category, legal holds and access/correction/deletion procedures. Financial and evidential history must be retained or anonymised appropriately rather than destructively deleting records without review. Applicants' retention dates are stored; a reviewed deletion job is still required.

## Test artefacts

Playwright traces can contain session cookies, development passwords, emails and verification links. They stay local and ignored. Do not publish traces without redaction. The seed uses generated local-only credentials and `.example.test` addresses. Production seeding is prohibited.

## Record lookup and recipient review

Restricted staff queries scope nested tenancy history and selection IDs as well as the parent tenant record. Re-inviting inactive staff or stakeholders applies the new grants; an invitation cannot overwrite an already-active manager's grants. Restricted owner dashboards use compliance categories rather than private free-form titles.

Single-record checks intersect the requested identifier with organisation and role scopes. Scope filters must never overwrite a supplied identifier. Regression tests cover restricted staff attempting a different organisation's property update, tenants attempting document uploads against another tenancy, and read-only owners supplying unauthorised property filters.

Document property/tenancy/repair links must be coherent. Tenant document recipients must also be authorised to access a linked repair. Revoking file access removes related in-app notifications; queued emails recheck current membership, organisation status, feature permission and object access before delivery. Rental passport entries are private to their author until they selectively export them.
