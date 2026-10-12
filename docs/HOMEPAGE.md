# Public homepage

The homepage uses a neutral, Apple-inspired visual direction: oversized system typography, layered translucent surfaces, restrained motion and warm architectural photography. The product name, logo and primary accent come from `src/lib/config.ts`; no permanent brand or final pricing is introduced.

The page showcases properties/rooms, manual rent tracking, repair permissions, documents, compliance records, property assets, EPC planning and the tenant portal. All displayed records and amounts are clearly labelled illustrations. Provider-dependent collection and unconfirmed capabilities are not marketed as operational.

## Components and behaviour

- `src/app/page.tsx`: marketing narrative, tenant illustration, onboarding explanation, pricing availability, native FAQ and registration links.
- `src/app/home.css`: homepage-scoped responsive presentation. Other public and authenticated pages retain their existing styling.
- `src/components/home/navigation.tsx`: floating glass navigation and mobile menu with Escape-key handling.
- `src/components/home/product-preview.tsx`: portfolio/rent/repairs/documents tour with accessible tabs, arrow-key navigation and Home/End controls.
- `src/components/home/repair-showcase.tsx`: labelled tenant/landlord illustration explaining private internal notes. It creates no real repair or permission change.
- `src/components/home/motion.tsx`: once-only viewport entrance animation. Content remains visible if JavaScript or observation is unavailable.

Reduced-motion preferences disable entrance, chart and transition animations. A reduced-transparency stylesheet provides opaque surfaces where the browser supports that preference. Public content and native FAQs render without JavaScript. The workspace loading indicator is scoped to `/app` so it does not hide the public marketing content behind a streaming fallback.

Images are served locally and optimised through Next.js; source/licence references are in `public/images/README.md`. Client visits do not contact an external image host.

## Verification

Five focused Playwright tests cover tabs/keyboard interaction, the repair illustration, mobile navigation and CTA links, responsive layouts at 320/390/768/1440 pixels, reduced motion and content without JavaScript. The complete browser suite also checks the existing landlord and tenant journeys. Local visual review covers desktop and mobile compositions. An additional axe-core scan checks WCAG A/AA rules across all feature and repair perspectives at desktop and mobile widths; this is automated checking, not an independent accessibility certification.

No site publication, paid activation or product launch is part of this change. Full application boundaries remain documented in `IMPLEMENTATION.md`.
