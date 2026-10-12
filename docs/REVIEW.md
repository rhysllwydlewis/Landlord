# Post-build review

Reviewed the draft implementation against access isolation, repair privacy, financial integrity, persisted editing workflows and the remaining specification gaps. This is an engineering pass, not an independent security or legal audit.

## Corrections

- Intersect requested record IDs with permitted properties/tenancies instead of allowing scope filters to replace IDs. Added direct server and browser/API denial tests.
- Intersect owner property filters and return compliance summaries without internal notes, document IDs or free-form titles.
- Validate coherent document links and require repair access for repair attachment recipients. Preserve sharing selections, notify newly authorised users and remove revoked file notifications.
- Preserve initial rent, apply changes transactionally, reject conflicts with allocated future rent, use the scheduler's clock consistently, and avoid marking due-today rent overdue.
- Continue periodic rent; prevent occupied-property archiving, archived-property occupation and overlapping tenancy reactivation. Cancel unallocated future schedules at move-out while retaining historical/manual ledger records.
- Keep onboarding progress from regressing when additional records are created.
- Preserve application details, landlord feedback responses and inventory acknowledgment data during edits. Keep rental passport entries private to their author.
- Show recent replies in long conversations and provide authorised pagination for earlier messages.
- Preserve form values and dialogs after failed submissions; prevent duplicate overlapping submissions and reuse financial submission keys across retries. Reload saved email preferences and show feedback in the relevant settings panel.
- Wrap report PDF rows instead of silently truncating them. PDF summaries currently normalise non-ASCII characters; CSV preserves original text.
- Require an explicit Stripe plan and price, pass configured trial lengths, retrieve current provider subscription state for signed events, allow resubscription after cancellation without repeating trials, ignore delayed events from old subscriptions, and recheck email recipients against current access and organisation status.

## Verification and boundaries

Validation includes strict TypeScript, lint, unit tests, PostgreSQL integration tests, browser journeys, a production build and the production dependency audit. The PR records the final results. Stripe contract tests use offline provider fixtures and the real SDK's signature verification; no provider account or money was involved.

The full master brief is still unfinished. [IMPLEMENTATION.md](IMPLEMENTATION.md) lists specific missing workflows and launch requirements. No external delivery, regulated rent collection, legal compliance certification, public deployment or production-readiness claim is made by this review. Deferred financial adjustments, deposit settlement, advanced workflows, GDPR operations and provider validation remain material launch blockers.
