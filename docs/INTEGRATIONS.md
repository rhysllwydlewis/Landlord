# Integration setup

## Stripe SaaS subscriptions

Set Stripe secret/webhook keys and APP_URL over HTTPS for production. Register `/api/webhooks/stripe` for `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`. Configure real Stripe monthly/annual Price IDs in administrator-managed production plans. Configure Stripe's customer portal (including plan changes, cancellation and invoice access).

The server creates/links customers with an idempotency key and opens checkout/portal sessions only for organisation owners. Successful checkout return is not payment confirmation; the signed webhook updates the subscription. Webhook IDs deduplicate processing. Test signatures, retries, cancellation, past-due states and upgrades/downgrades with Stripe test mode before real billing.

Tenant rent is a different integration. No funds are held/transferred and no tenant online payment button is offered.

## Resend transactional email

Set `RESEND_API_KEY` and an authorised verified `EMAIL_FROM` sender. Run `npm run jobs` on a supervised scheduler. Emails use configurable product subjects and generic notifications to avoid unnecessary tenant/financial data in mail. Verification/reset/invitation mail contains private action links.

Without credentials, development retains local outbox messages; production fails/retries delivery rather than falsely marking messages sent. Failed jobs are visible to the protected admin. Routine email preferences do not disable essential identity mail. Recipient access is rechecked for queued repair/document notifications.

## S3-compatible file storage

Set storage driver to `s3`, region, bucket and server-side credentials; set an endpoint for another compatible service. Enable private bucket/block-public-access controls and restrict the service identity to the application bucket/prefix. The adapter requests server-side encryption; verify compatibility with the chosen service. Use workload identity instead of static credentials when adding production infrastructure support.

Uploads use random keys and content validation. Downloads are authenticated streams, not public object links. Configure lifecycle/versioning/backups and malware scanning; test tenant grants and revocation against the actual bucket.

## External provider contracts

`src/server/providers.ts` defines typed capability adapters for rent collection, signatures, referencing, identity, banking, accounting, deposit schemes, property portals, tax submissions, extraction, image comparison, sensors and credit reporting. These adapters are intentionally unconfigured. Implementing one requires legitimate access, provider approval where applicable, SDK/API calls, signature validation, durable event IDs, failure handling, audited manual override and appropriate user consent.

Keep provider-dependent actions disabled until verified. Never mark a credit/identity check, legally signed file, protected deposit, published portal listing, HMRC submission, connected bank account or real payment complete merely from an internal manual status.
