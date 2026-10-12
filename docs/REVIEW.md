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

## Additional manual review

The second pass read the homepage source, styles and interaction tests line by line, and inspected authentication/invitations, organisation scopes, repair/document permissions, the ledger, reminders, imports, reports and related routes. This is a targeted engineering review, not a claim that every repository line or every possible defect has been independently audited.

Corrections include:

- Filter nested tenancy history and selector IDs as well as top-level tenant records for property-restricted staff.
- Apply the new invitation's permissions and property restrictions when reactivating an inactive staff/stakeholder membership. Reject invitations that would replace an already-active manager's permissions; additional tenant-record invitations remain supported.
- Redact free-form compliance titles in the restricted owner dashboard, consistent with the compliance list.
- Replace the mobile homepage menu with native disclosure navigation, fix desktop-resize and closed-menu Escape behaviour, and close on outside clicks or focus leaving the header.
- Preserve high-contrast heading text, keep every tab linked to a persistent labelled panel, honour changing motion preferences, and skip entrance animation on focused controls or unsupported browsers, and cancel an active entrance when focus enters. Interactive sections fade without positional movement, so cancellation cannot shift a clicked button away from the pointer.
- Make shared secure forms inert with disabled native fields until their handlers are attached and enforce POST, preventing default GET submissions from placing passwords in URLs. Provide an explicit JavaScript-required message when scripts are disabled.
- Keep JavaScript-only preview controls disabled until hydration completes, preventing lost initial clicks on slower connections.
- Improve sign-in/account text contrast and add a focusable main landmark for the shared skip link.
- Improve narrow-screen caption contrast, use configured branding in homepage metadata and the shared footer, make skip/hash destinations focusable, and remove preview copy referring to a nonexistent photograph.

Regression tests reproduced the access leaks, stale staff grants, broken menu/contrast behaviour and incomplete tab associations before their fixes. Final verification totals and CI evidence are recorded on the PR. The existing implementation and launch limitations still apply.
