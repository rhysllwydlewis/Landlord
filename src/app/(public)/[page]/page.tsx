import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicLayout } from "@/components/public";
import { db } from "@/server/db";
import { money } from "@/lib/calculations";
import { brand } from "@/lib/config";
const pages: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  features: {
    title: "Your rental business, connected.",
    intro: "Built around the everyday work of landlords and tenants.",
    sections: [
      [
        "Properties and tenancies",
        "Manage property specifications, rooms, tenants, tenancy history, deposits and rent schedules together.",
      ],
      [
        "Repairs and maintenance",
        "Tenant reports and private landlord records share a single workflow. Explicit grants control tenant access; comments and files have their own visibility.",
      ],
      [
        "Finances and planning",
        "Manual payments, partial allocations, expenses, exports and deterministic forecasts give you a view of the numbers.",
      ],
      [
        "Compliance and evidence",
        "Record certificates and expiry dates, keep evidence and use administrator-reviewed jurisdiction rules.",
      ],
      [
        "Tenant experience",
        "A private portal for rent information, messages, shared documents, maintenance and feedback.",
      ],
      [
        "Integrations",
        "Stripe subscription billing, Resend email and private S3 storage can be configured. Regulated rent collection and other provider-dependent functions remain disabled until implemented and approved.",
      ],
    ],
  },
  about: {
    title: "Built for the work behind a well-managed home.",
    intro:
      "This platform is a developing product for UK rental businesses. Its permanent company name and identity have not yet been chosen.",
    sections: [
      [
        "Our purpose",
        "Bring practical property administration into one secure workspace, with thoughtful tools for both landlords and tenants.",
      ],
      [
        "Our approach",
        "Keep data private, make financial records traceable and describe integrations honestly. We do not publish fabricated customer claims, certifications or reviews.",
      ],
    ],
  },
  contact: {
    title: "Get in touch.",
    intro: brand.supportEmail
      ? `Contact ${brand.supportEmail} for support and enquiries.`
      : "Support contact details are not yet configured. This page will be updated before launch.",
    sections: [
      [
        "Existing users",
        "Your landlord or property manager remains the first contact for tenancy questions, rent records and repairs.",
      ],
      [
        "Emergencies",
        "For immediate danger call 999. Use your property’s emergency contacts for urgent maintenance. This portal is not continuously monitored.",
      ],
    ],
  },
  help: {
    title: "A little help, when you need it.",
    intro: "Start with the workflow you’re working on.",
    sections: [
      [
        "Getting started",
        "Register and verify your email. Landlords create an organisation, add properties, add tenants and create tenancies. Invite tenants from their record.",
      ],
      [
        "Reporting a repair",
        "Open Repairs, choose Report a repair, select your property and describe the issue. Add photographs or supporting files. Track the status and message your landlord on the repair page.",
      ],
      [
        "Repair privacy",
        "New landlord repairs are private. Landlords can share with selected tenants or current affected occupants and revoke access later. The reporting tenant retains access to their own request.",
      ],
      [
        "Rent records",
        "Landlords record received payments in Rent & payments. Payments allocate to the oldest outstanding obligation. Excess payments remain as unapplied credit until an obligation is created.",
      ],
      [
        "Documents",
        "Upload PDFs or images. Files are private unless explicitly shared. Tenant access to repair files also requires access to the repair.",
      ],
      [
        "Importing a spreadsheet",
        "Open Import & export. Choose a record type, upload CSV, map columns, review validation errors and confirm a valid preview. Existing records are never silently overwritten.",
      ],
    ],
  },
  privacy: {
    title: "Privacy notice — pre-launch draft",
    intro:
      "This configurable draft must be completed and reviewed before any public launch or processing of real customer data.",
    sections: [
      [
        "Controller and contact",
        "The operating company, registered address, privacy contact, lawful bases and processor agreements must be supplied before launch.",
      ],
      [
        "Data and purpose",
        "The platform stores accounts, property and tenancy records, rent records, documents and communications to support property administration. Private information is restricted to authorised users.",
      ],
      [
        "Sharing and providers",
        "Configured providers may process authentication, email, subscription billing and file storage data. Provider contracts, processing regions and international transfer arrangements require review.",
      ],
      [
        "Retention and your rights",
        "Data is retained for configured administrative and legal purposes. Account export and deletion requests are recorded for review; financial and evidential records must not be deleted without considering retention duties. Contact the controller to exercise applicable rights.",
      ],
      [
        "Consent and portable profiles",
        "Optional rental passport entries are included in exports only with selective sharing and consent. Platform records are distinguished from self-reported information.",
      ],
    ],
  },
  terms: {
    title: "Terms of service — pre-launch draft",
    intro:
      "These terms require business-specific and legal review before the platform is offered commercially.",
    sections: [
      [
        "Service",
        "The platform provides property administration tools. It does not provide regulated legal, tax or investment advice.",
      ],
      [
        "Accounts and permissions",
        "Users must keep credentials secure and access only records they are authorised to view. Organisation owners control staff and tenant sharing.",
      ],
      [
        "Payments and integrations",
        "SaaS subscriptions and tenant rent collection are separate. No provider-dependent financial transaction is represented as successful without genuine confirmation.",
      ],
      [
        "Compliance and responsibility",
        "Recorded compliance information is not a guarantee of legal compliance. Requirements differ by jurisdiction and change over time.",
      ],
      [
        "Commercial terms pending",
        "Company identity, prices, payment terms, cancellation policy, service commitments, liability provisions and dispute procedures must be completed before launch.",
      ],
    ],
  },
  cookies: {
    title: "Cookies and local storage",
    intro:
      "Only essential authentication cookies are used by this build. There is no analytics or advertising tracking.",
    sections: [
      [
        "Authentication",
        "Secure session cookies keep users signed in. They use HttpOnly and SameSite controls, with Secure enabled in production.",
      ],
      [
        "Workspace selection",
        "An essential cookie remembers the selected organisation. The server verifies membership independently on every request.",
      ],
      [
        "Optional technologies",
        "If analytics or advertising is added, an appropriate consent interface and policy must be implemented before non-essential storage begins.",
      ],
    ],
  },
};
export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const slug = (await params).page;
  if (slug === "pricing") {
    const plans = await db.subscriptionPlan.findMany({
      where: {
        active: true,
        ...(process.env.NODE_ENV === "production"
          ? { developmentOnly: false }
          : {}),
      },
      orderBy: { monthlyPence: "asc" },
    });
    return (
      <PublicLayout>
        <div className="public-section prose-page">
          <span className="eyebrow">PLANS THAT GROW WITH YOUR PORTFOLIO</span>
          <h1>Pricing, on your terms.</h1>
          <p>
            Final plan names and prices are not yet decided. Development sample
            configuration is shown below when available.
          </p>
          <div className="pricing-grid">
            {plans.map((p) => (
              <article key={p.id}>
                <span className="eyebrow">
                  {p.developmentOnly
                    ? "DEVELOPMENT SAMPLE"
                    : "SUBSCRIPTION PLAN"}
                </span>
                <h2>{p.name}</h2>
                <strong className="price">
                  {money(p.monthlyPence)}
                  <small>/ month</small>
                </strong>
                <p>{money(p.annualPence)} annually</p>
                <ul>
                  <li>Up to {p.propertyLimit} properties</li>
                  <li>Up to {p.unitLimit} units / rooms</li>
                  <li>{p.staffLimit} staff members</li>
                  <li>{p.trialDays}-day configured trial</li>
                </ul>
                <Link className="button primary full" href="/register">
                  Get started
                </Link>
              </article>
            ))}
          </div>
          {!plans.length && (
            <p>Plans are awaiting administrator configuration.</p>
          )}
        </div>
      </PublicLayout>
    );
  }
  const p = pages[slug];
  if (!p) notFound();
  return (
    <PublicLayout>
      <article className="public-section prose-page">
        <span className="eyebrow">PROPERTY MANAGEMENT PLATFORM</span>
        <h1>{p.title}</h1>
        <p className="prose-intro">{p.intro}</p>
        {p.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <Link href="/register" className="button primary">
          Create account
        </Link>
      </article>
    </PublicLayout>
  );
}
