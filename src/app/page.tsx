import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  House,
  Wrench,
  CirclePoundSterling,
  ShieldCheck,
  Users,
  Files,
  Building2,
} from "lucide-react";
import { PublicLayout } from "@/components/public";
export default function Home() {
  return (
    <PublicLayout>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-pill">
            <span className="status-dot" /> BUILT FOR UK PROPERTY MANAGEMENT
          </span>
          <h1>
            More clarity.
            <br />
            Less paperwork.
            <br />
            <em>Better property management.</em>
          </h1>
          <p>
            Bring your properties, tenants, rent and repairs together. One calm,
            connected workspace for your rental business.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/register">
              Create your workspace <ArrowRight size={17} />
            </Link>
            <Link href="/features" className="button secondary">
              Explore the platform <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-checks">
            <span>
              <Check size={14} />
              Private tenant portal
            </span>
            <span>
              <Check size={14} />
              Designed for UK portfolios
            </span>
          </div>
        </div>
        <div className="hero-preview">
          <div className="preview-label">ILLUSTRATIVE PRODUCT PREVIEW</div>
          <div className="preview-window">
            <div className="preview-sidebar">
              <Building2 size={24} />
              <div className="preview-side-active">
                <House size={15} />
                Overview
              </div>
              <div>
                <House size={15} />
                Properties
              </div>
              <div>
                <Users size={15} />
                Tenants
              </div>
              <div>
                <CirclePoundSterling size={15} />
                Rent & payments
              </div>
              <div>
                <Wrench size={15} />
                Repairs
              </div>
              <div>
                <ShieldCheck size={15} />
                Compliance
              </div>
            </div>
            <div className="preview-main">
              <div className="preview-top">
                Your portfolio, in perspective. <span>●</span>
              </div>
              <h3>Good morning, landlord.</h3>
              <p>Everything you need. Nothing you don’t.</p>
              <div className="preview-stats">
                <div>
                  <small>Properties</small>
                  <strong>12</strong>
                  <span>Portfolio overview</span>
                </div>
                <div>
                  <small>Monthly rent</small>
                  <strong>£14,250</strong>
                  <span>Recorded income</span>
                </div>
                <div>
                  <small>Open repairs</small>
                  <strong>3</strong>
                  <span>Keep things moving</span>
                </div>
              </div>
              <div className="preview-chart">
                <strong>Rental income</strong>
                <span>Last 6 months</span>
                <svg viewBox="0 0 450 130" aria-hidden="true">
                  <defs>
                    <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="#4b927c" stopOpacity=".25" />
                      <stop offset="1" stopColor="#4b927c" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 110L65 89L130 95L195 62L260 72L325 31L395 39L450 12V130H0Z"
                    fill="url(#heroFill)"
                  />
                  <path
                    d="M0 110L65 89L130 95L195 62L260 72L325 31L395 39L450 12"
                    fill="none"
                    stroke="#28715a"
                    strokeWidth="3"
                  />
                </svg>
                <div className="preview-months">
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                </div>
              </div>
              <div className="preview-repair">
                <span className="repair-icon">
                  <Wrench size={17} />
                </span>
                <div>
                  <strong>Kitchen tap leaking</strong>
                  <small>12 Willow Road</small>
                </div>
                <span className="badge amber">In progress</span>
              </div>
            </div>
          </div>
          <div className="preview-float">
            <ShieldCheck size={23} />
            <div>
              <strong>Privacy comes built in</strong>
              <span>You control what tenants can see.</span>
            </div>
          </div>
        </div>
      </section>
      <div className="value-strip">
        <span>ONE WORKSPACE. EVERYDAY CLARITY.</span>
        <strong>Properties & tenancies</strong>
        <strong>Rent & accounting</strong>
        <strong>Repairs & compliance</strong>
        <strong>Tenant relationships</strong>
      </div>
      <section className="public-section">
        <div className="section-heading">
          <span className="eyebrow">LESS ADMIN. MORE OVERSIGHT.</span>
          <h2>
            Everything connected.
            <br />
            Everything easier to find.
          </h2>
          <p>
            Practical tools for the details that make a rental business run
            well.
          </p>
        </div>
        <div className="feature-grid">
          {[
            [
              House,
              "A portfolio that makes sense",
              "Manage single lets, HMOs and individual rooms with connected property and tenancy records.",
            ],
            [
              CirclePoundSterling,
              "Know where your rent stands",
              "Record payments, allocate partial receipts and see arrears with a clear manual ledger.",
            ],
            [
              Wrench,
              "Repairs without the guesswork",
              "Tenants report issues. You manage progress and decide who can see each repair.",
            ],
            [
              ShieldCheck,
              "Keep the evidence together",
              "Record certificate dates, track reminders and retain historical compliance documents.",
            ],
            [
              Users,
              "A better tenant experience",
              "Give tenants secure access to their tenancy, shared files, messages and repair updates.",
            ],
            [
              Files,
              "A home for your paperwork",
              "Store documents privately and share them deliberately with authorised tenants.",
            ],
          ].map(([Icon, title, text]) => (
            <article key={String(title)}>
              <span className="feature-icon">
                <Icon size={23} />
              </span>
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="tenant-section">
        <div className="tenant-illustration">
          <div className="tenant-phone">
            <span className="phone-speaker" />
            <span className="eyebrow">YOUR HOME</span>
            <h3>A little peace of mind.</h3>
            <div>
              <House size={23} />
              <strong>My tenancy</strong>
              <p>Details and documents, together.</p>
            </div>
            <div>
              <Wrench size={23} />
              <strong>Report a repair</strong>
              <p>Explain it. Attach photos. Track it.</p>
            </div>
            <Link href="/register" className="button primary full">
              Create account <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div>
          <span className="eyebrow">
            BETTER FOR YOU. BETTER FOR YOUR TENANTS.
          </span>
          <h2>Good relationships start with clear communication.</h2>
          <p>
            A dedicated portal gives tenants a simple way to ask questions,
            access shared documents and follow repair progress. Their private
            information stays private.
          </p>
          <Link href="/features" className="text-link">
            Explore the tenant experience <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="public-section faq-section">
        <div className="section-heading">
          <span className="eyebrow">A FEW GOOD QUESTIONS</span>
          <h2>Before you get started.</h2>
        </div>
        <div>
          {[
            [
              "Can I manage rooms in an HMO?",
              "Yes. Properties can have individual rooms or units, with separate tenancies and rent schedules. Common-area repairs are linked to the property.",
            ],
            [
              "Can tenants see my private repairs?",
              "Landlord-created repairs are private by default. You must explicitly share access; private notes and attachments remain controlled separately.",
            ],
            [
              "Do I need a payment provider to record rent?",
              "No. Manual rent recording and payment allocation work independently. Online collection remains unavailable until an approved provider is configured.",
            ],
            [
              "Are the prices final?",
              "No. The product name and pricing are still being decided. Development sample plans are clearly marked and do not process real money.",
            ],
            [
              "Does the platform provide legal or tax advice?",
              "No. Compliance records, reviewed rules and financial summaries support administration. Applicable legal and tax requirements need appropriate professional review.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="public-cta">
        <span className="eyebrow">MAKE ROOM FOR BETTER MANAGEMENT</span>
        <h2>
          Your rental business.
          <br />A clearer view.
        </h2>
        <Link className="button light" href="/register">
          Create your workspace <ArrowUpRight size={16} />
        </Link>
      </section>
    </PublicLayout>
  );
}
