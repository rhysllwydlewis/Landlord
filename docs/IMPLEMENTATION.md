# Implementation status and remaining work

This build implements a serious working foundation and a useful set of operational modules. It does **not** meet every requirement in the master specification. Pages rendering is not treated as proof that all detailed workflows are complete.

## Implemented and connected

| Area                  | Available behaviour                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity              | Registration, email verification, login/logout, password reset/change, database sessions, authenticator setup/challenge, organisation creation, persistent onboarding progress                                            |
| Permissions           | Owner/staff/tenant/stakeholder roles, domain read/write staff permissions, property restrictions, audited protected platform administration                                                                               |
| Properties            | Create/edit/archive, units/rooms, portfolio and ownership entities, specifications, private notes, linked records and file uploads                                                                                        |
| Tenants and tenancies | Tenant records, joint participant structure, room tenancies, invitations/activation, history-preserving status transitions, future rent amount changes                                                                    |
| Repairs               | Tenant reports and private landlord repairs, urgency/category, reference, status timeline, public/private comments, selected-tenant/occupant sharing, revocation, private file handling, linked actual expenses           |
| Rent                  | Recurring obligations, manual received payments, integer amounts, partial allocations, credit balances, arrears, reminders, statements/CSV exports                                                                        |
| Documents             | Real PDF/image uploads, content signature checks, private local/S3 storage, authorised streaming downloads, selected tenant grants, explicit owner sharing                                                                |
| Communication         | Tenancy conversations, selected participants, message history, read markers, notification centre, queued email and routine email preferences                                                                              |
| Compliance            | Certificate dates, uploads linked to records, reminders, explicit replacements retaining prior records, versioned/source-backed reviewed rule configuration and task generation                                           |
| Operations            | Tasks/recurrence/calendar, expense categories/reconciliation flags, asset servicing/replacement signals, manual inventories with document evidence, side-by-side comparison, tenant acknowledgment, transition checklists |
| Deposits              | Manual scheme/status records, received/returned amounts, proposed/agreed deductions and tenant response records, PDF evidence pack incorporating supported linked files                                                   |
| Lettings              | Hosted public listings, enquiries/consent/retention date, applicant statuses, manual referencing status records, accepted-applicant tenant conversion                                                                     |
| Insights              | Cash-basis reports with dates/property filters and CSV/PDF, saved deterministic forecasts, duplicate/high-cost review signals and review decisions                                                                        |
| Differentiators       | EPC improvement records, private feedback/complaints/requests, self-reported rental passport entries with sharing/consent and selective exports of actual tenancy ledger records, validated atomic CSV imports            |
| Subscriptions         | Administrator-defined plans, trials/limits/entitlements, development-only sample provider, Stripe checkout/portal handlers and signed deduplicated webhooks                                                               |
| Administration        | Organisation/user metadata, subscription distribution, plan/rule creation and update API, job failures/retry, audits, account suspension and feature flags                                                                |
| Public website        | Home/features/pricing/about/contact/help, account pages and configurable pre-launch legal/cookie drafts, responsive design                                                                                                |

## Verified in this environment

The automated suites cover authentication/onboarding through the browser; database organisation and role boundaries; property/tenancy creation; rent allocation/idempotency; private and selectively shared repairs; revocation and attachment access; comments/status/notifications; compliance reminders and replacement history; deposit bounds; persisted financial reports; import validation/commit; future rent changes; quota concurrency; and rejection of development subscriptions in production.

Browser tests use real local PostgreSQL records and exercise landlord and tenant journeys, including photograph upload, invitation activation and mobile navigation. Provider-dependent services have not been tested with real accounts. See the final verification log/PR description for the counts from the latest run; the test sources remain the source of truth.

## Implemented interfaces, unavailable providers

Stripe Billing, Resend and private S3 storage require the operator's real/test credentials and service setup. No credentials were supplied for this task, so no remote transaction, delivery or storage claim is made.

Rent collection/Direct Debit, external signing, referencing/identity, Open Banking, Xero, deposit scheme confirmation, Rightmove/Zoopla, HMRC/MTD, credit rent reporting, sensors, document extraction and inventory analysis are unconfigured adapter contracts, **not completed integrations**. Essential manual ledger, files, repairs, expenses, compliance and deposit records function independently.

## Work still required to fulfil the entire brief

- Rich property details for mortgages/insurance/licensing, room editing/archiving, owner/entity assignment interfaces and comprehensive property history presentation.
- Full digital tenant applications with employment/guarantor inputs, applicant files, holding deposits, viewing calendar and application-to-tenancy conversion. Current applicant acceptance creates a tenant record; tenancy creation is a separate supported workflow.
- Rent schedule edits for frequency/due-date changes, payment arrangements, structured adjustments/reversals, rent receipt templates and a regulated online collection provider.
- Rich repair estimates/completion cost records, supplier/invoice receipts directly on expense entries, configurable emergency guidance/contact details and more advanced sorting/report dimensions.
- Document previews/version replacement/expiry automation, editable correspondence templates, signatures, message attachments and full announcement workflows.
- Complete tenant profile/accessibility/contact-preference controls, important property notices/welcome guides and interactive deposit deduction response handling. Tenant deposit information is currently read-only; responses are recorded by an authorised manager.
- Detailed inventory video/meter/key evidence workflows, portable inspections, signed acknowledgments and full move-out settlement automation. Transition tasks/checklists and status updates work, but checklist completion does not automatically settle deposits or end a tenancy.
- Recurring accounting expenses, full bank statement matching/import reconciliation, mortgage/refinancing/hold-versus-sell scenarios, owner statement history and every requested report/filter/export type.
- Expanded maintenance spending/repeated-fault rules, more anomaly thresholds/severities, configurable reminder timing, complaint escalation and dedicated complaint response interfaces. Review decisions are persisted; not all alert types are implemented.
- A complete portable rental passport with verified platform histories, external consent-scoped sharing links, references, tenant data exports and inter-organisation portability. Current free-form entries are self-reported; opted-in exports can include labelled manual tenancy ledger records. No credit scores or tenant ratings are generated.
- Import correction/rollback UI after commit, bank CSV import, bulk upload, tolerant quoted-header field mapping and cross-spreadsheet natural-key reconciliation. Current imports are bounded, validate a preview, commit atomically and never overwrite existing records.
- Organisation defaults/timezone/currency editing, configurable data-retention/deletion processing, fine-grained administrator support escalation, richer platform health metrics and plan/rule editing interfaces (update API exists for plans; compliance changes are new versions).
- Independently reviewed legal policies/compliance rules, penetration testing, accessibility audit, production provider verification, backup/restore drills, load/performance testing and launch operational procedures.

No contractor roles or AI assistant interface should be added as part of completing this version. Optional analysis must retain manual alternatives.
