import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  House,
  Wrench,
  CirclePoundSterling,
  ShieldCheck,
  Users,
  Files,
  LockKeyhole,
  CalendarDays,
  Leaf,
  Upload,
  Layers3,
  Plus,
  MessageCircle,
  MoveUpRight,
} from "lucide-react";
import { PublicLayout } from "@/components/public";
import { HomeMotion } from "@/components/home/motion";
import { ProductPreview, FeatureTour } from "@/components/home/product-preview";
import { RepairShowcase } from "@/components/home/repair-showcase";
import { brand } from "@/lib/config";
import "./home.css";
export const metadata: Metadata = {
  title: `${brand.name} — A clearer view of your rental business`,
  description:
    "Bring properties, tenants, rent and repairs together in one thoughtfully designed workspace for UK landlords. Explore the platform and create your account.",
};
const questions = [
  [
    "Who is the platform for?",
    "Individual landlords, property companies and authorised property managers. You can organise single lets, HMOs and buildings with individual rooms or units, and give tenants their own secure portal.",
  ],
  [
    "What can my tenants see?",
    "Their own relevant tenancy and rent records, their reported repairs, and information you explicitly share. Landlord-created repairs are private by default, with separate controls for comments and files.",
  ],
  [
    "Can I bring my existing spreadsheets?",
    "Yes. CSV imports let you preview and validate properties, tenants, tenancies, payments and expenses before committing them. Existing records are not silently overwritten.",
  ],
  [
    "How does rent tracking work?",
    "Record received payments manually, allocate partial payments and track outstanding balances. Manual tracking works without a payment-provider account. Online rent collection is unavailable until an approved provider is configured.",
  ],
  [
    "How much does it cost?",
    "Final plan names and prices are being prepared. The pricing page shows current availability. Any development sample plans are labelled and do not process real subscription payments.",
  ],
  [
    "Does it replace legal or tax advice?",
    "No. The platform helps organise records, reminders and financial summaries. Applicable tenancy, compliance and tax requirements still need appropriate professional review.",
  ],
];
const capabilities = [
  { icon: House, label: "Properties & tenancies" },
  { icon: CirclePoundSterling, label: "Rent & finances" },
  { icon: Wrench, label: "Repairs & maintenance" },
  { icon: ShieldCheck, label: "Compliance & documents" },
  { icon: Users, label: "Your tenant portal" },
];
const startupSteps = [
  {
    icon: Layers3,
    title: "Create your workspace",
    text: "Set up your organisation and make room for your rental business.",
  },
  {
    icon: Upload,
    title: "Bring your portfolio",
    text: "Add properties and rooms, or preview and import your existing CSV records.",
  },
  {
    icon: Users,
    title: "Invite your people",
    text: "Connect tenancies, invite tenants and give staff the access they need.",
  },
];
export default function Home() {
  return (
    <PublicLayout premium>
      <HomeMotion />
      <noscript>
        <style>{`.premium-site .home-tour-tabs, .premium-site .home-repair-view-toggle { display: none; }`}</style>
      </noscript>
      <main id="main" tabIndex={-1} className="home-main">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="hero-aura" aria-hidden="true" />
          <div className="home-hero-copy">
            <div className="home-pill">
              <span className="home-live-dot" /> A little more order. A lot more
              possibility.
            </div>
            <h1 id="home-heading">
              More clarity.
              <br />
              <span>Less to think about.</span>
            </h1>
            <p>
              Your properties. Your people. Your peace of mind.
              <br className="home-desktop-break" /> Bring your rental business
              together in one beautiful workspace.
            </p>
            <div className="home-hero-actions">
              <Link href="/register" className="home-button">
                Create your workspace{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a href="#product-tour" className="home-button home-button-ghost">
                Take a closer look <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <div className="home-hero-details">
              <span>
                <Check size={13} /> Built for UK landlords
              </span>
              <span>
                <Check size={13} /> A dedicated tenant portal
              </span>
            </div>
          </div>
          <div className="home-hero-stage">
            <div className="home-scene">
              <Image
                src="/images/living-space.webp"
                alt=""
                fill
                sizes="(max-width: 1100px) 100vw, 1200px"
                preload
              />
              <div className="home-scene-tint" />
            </div>
            <div className="hero-product">
              <ProductPreview />
            </div>
            <div className="hero-glass-note glass">
              <span className="home-note-icon">
                <Check size={17} />
              </span>
              <div>
                <strong>Everything in its place.</strong>
                <span>Properties, rent and repairs. Connected.</span>
              </div>
            </div>
            <div className="hero-privacy-note glass">
              <LockKeyhole size={16} />
              <span>
                Private by default.
                <br />
                <strong>Shared on your terms.</strong>
              </span>
            </div>
            <p className="home-preview-caption">
              Illustrative product preview · sample data
            </p>
          </div>
          <a className="home-scroll-cue" href="#features">
            A better way to look after your portfolio <ChevronDown size={16} />
          </a>
        </section>
        <div className="home-capabilities" aria-label="Platform capabilities">
          {capabilities.map(({ icon: Icon, label }) => (
            <span key={label}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
        <section
          id="features"
          tabIndex={-1}
          className="home-section home-tour-section"
        >
          <div className="home-section-heading" data-reveal>
            <span className="home-eyebrow">
              ONE WORKSPACE. A CLEARER PICTURE.
            </span>
            <h2>
              Less switching.
              <br />
              <span>More perspective.</span>
            </h2>
            <p>
              From the big picture to the small details.
              <br />
              Everyday essentials, thoughtfully connected.
            </p>
          </div>
          <div id="product-tour" tabIndex={-1} data-reveal>
            <FeatureTour />
          </div>
        </section>
        <section className="home-repair-section" data-reveal>
          <div className="home-repair-copy">
            <span className="home-eyebrow">
              REPAIRS, WITH LESS BACK AND FORTH
            </span>
            <h2>
              A small problem.
              <br />
              <span>A clear next step.</span>
            </h2>
            <p>
              A leaking tap shouldn’t become a lost message. Give tenants a
              simple way to report an issue, then keep the details, photos and
              updates together.
            </p>
            <div className="home-repair-steps">
              {[
                [
                  "01",
                  "Report it",
                  "A description, photos and a repair reference.",
                ],
                [
                  "02",
                  "Keep it moving",
                  "Acknowledge the issue and update its status.",
                ],
                [
                  "03",
                  "Keep people informed",
                  "Share progress with the people who need it.",
                ],
              ].map(([n, title, text]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/features" className="home-text-link">
              Explore repair management <ArrowUpRight size={16} />
            </Link>
          </div>
          <RepairShowcase />
        </section>
        <section className="home-section home-benefits-section">
          <div className="home-section-heading" data-reveal>
            <span className="home-eyebrow">MAKE SPACE FOR WHAT MATTERS</span>
            <h2>
              A little order.
              <br />
              <span>A lot more headspace.</span>
            </h2>
            <p>
              Practical tools that make the everyday easier,
              <br />
              without adding another layer of admin.
            </p>
          </div>
          <div className="home-bento-grid">
            <article className="home-bento home-money-bento" data-reveal>
              <span className="home-card-icon">
                <CirclePoundSterling size={23} />
              </span>
              <h3>Know where your rent stands.</h3>
              <p>
                See what’s due, what’s been recorded and what still needs your
                attention. Partial payments included.
              </p>
              <div className="home-ledger-mini glass">
                <div>
                  <span>October rent</span>
                  <span className="home-status">Part paid</span>
                </div>
                <strong>
                  £250<span>remaining</span>
                </strong>
                <div className="home-payment-track">
                  <i />
                </div>
                <div className="home-ledger-breakdown">
                  <span>£600 recorded</span>
                  <span>£850 due</span>
                </div>
                <small>Illustrative manual rent record</small>
              </div>
            </article>
            <article className="home-bento home-calendar-bento" data-reveal>
              <span className="home-card-icon">
                <CalendarDays size={23} />
              </span>
              <h3>
                Your next deadline.
                <br />
                Already on your radar.
              </h3>
              <p>
                Record certificate dates, create reminders and keep the evidence
                together.
              </p>
              <div className="home-calendar-mini" aria-hidden="true">
                <div>
                  <span>YOUR PROPERTY CALENDAR</span>
                  <CalendarDays size={15} />
                </div>
                <div className="home-calendar-dates">
                  {[10, 11, 12, 13, 14].map((n) => (
                    <span
                      key={n}
                      className={n === 12 ? "calendar-selected" : ""}
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <div className="home-calendar-event">
                  <span />
                  <div>
                    <strong>Certificate review</strong>
                    <small>A reminder based on your recorded date</small>
                  </div>
                </div>
              </div>
            </article>
            <article className="home-bento home-document-bento" data-reveal>
              <span className="home-card-icon">
                <Files size={23} />
              </span>
              <h3>
                The right document.
                <br />
                Right where you need it.
              </h3>
              <p>
                Keep property and tenancy files organised. Choose exactly who
                has access.
              </p>
              <div className="home-file-stack" aria-hidden="true">
                <div className="home-file-back" />
                <div className="home-file-front glass">
                  <span className="home-pdf-icon">PDF</span>
                  <div>
                    <strong>Tenancy agreement</strong>
                    <small>
                      <LockKeyhole size={10} /> Shared with selected tenants
                    </small>
                  </div>
                  <Check size={16} />
                </div>
              </div>
            </article>
            <article className="home-bento home-health-bento" data-reveal>
              <span className="home-card-icon">
                <Leaf size={23} />
              </span>
              <h3>Look after tomorrow, too.</h3>
              <p>
                Track servicing dates, property assets and EPC improvement
                plans. Turn the next job into a planned one.
              </p>
              <div className="home-asset-mini">
                <span className="home-asset-check">
                  <Check size={17} />
                </span>
                <div>
                  <strong>Boiler service recorded</strong>
                  <small>Keep a history. Plan the next visit.</small>
                </div>
                <MoveUpRight size={17} />
              </div>
            </article>
          </div>
        </section>
        <section className="home-tenant-section home-section">
          <div className="home-phone-stage" data-reveal>
            <div className="home-phone-orbit" aria-hidden="true" />
            <div className="home-phone">
              <div className="home-phone-camera" />
              <div className="home-phone-time" aria-hidden="true">
                9:41 <span>● ▰</span>
              </div>
              <div className="home-phone-content">
                <span className="home-eyebrow">YOUR HOME, CONNECTED</span>
                <h3>Hello, Jamie.</h3>
                <p>Make yourself at home.</p>
                <div className="home-phone-property">
                  <Image
                    src="/images/living-space.webp"
                    width={300}
                    height={170}
                    alt=""
                  />
                  <div>
                    <strong>12 Willow Road</strong>
                    <span>Room 1 · Tenancy overview</span>
                  </div>
                </div>
                <div className="home-phone-rent">
                  <span>Next recorded rent due</span>
                  <strong>
                    £850<span>1 November</span>
                  </strong>
                </div>
                <div className="home-phone-repair">
                  <span>
                    <Wrench size={17} />
                  </span>
                  <div>
                    <strong>Kitchen tap</strong>
                    <small>In progress · View your updates</small>
                  </div>
                  <ArrowUpRight size={15} />
                </div>
                <div className="home-phone-tabs" aria-hidden="true">
                  <span>
                    <House size={18} />
                    Home
                  </span>
                  <span>
                    <CirclePoundSterling size={18} />
                    Rent
                  </span>
                  <span>
                    <Wrench size={18} />
                    Repairs
                  </span>
                  <span>
                    <MessageCircle size={18} />
                    Messages
                  </span>
                </div>
              </div>
            </div>
            <div className="home-phone-note glass">
              <MessageCircle size={18} />
              <div>
                <strong>A clearer conversation.</strong>
                <span>Updates that don’t get lost.</span>
              </div>
            </div>
            <p className="home-phone-caption">
              Illustrative tenant portal · sample data
            </p>
          </div>
          <div className="home-tenant-copy" data-reveal>
            <span className="home-eyebrow">BETTER FOR EVERYONE AT HOME</span>
            <h2>
              A place for
              <br />
              <span>your tenants, too.</span>
            </h2>
            <p>
              Good relationships start with clarity. Give tenants a dedicated
              portal for the things that matter to them, with access to their
              own information.
            </p>
            <ul className="home-check-list">
              <li>
                <Check size={16} /> Tenancy details and rent history
              </li>
              <li>
                <Check size={16} /> Simple repair reports and progress updates
              </li>
              <li>
                <Check size={16} /> Shared documents and direct messages
              </li>
              <li>
                <Check size={16} /> Private information stays private
              </li>
            </ul>
            <Link href="/features" className="home-button home-button-white">
              Explore the tenant experience <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
        <section
          id="how-it-works"
          tabIndex={-1}
          className="home-section home-start-section"
        >
          <div className="home-section-heading" data-reveal>
            <span className="home-eyebrow">
              A FRESH START, WITHOUT STARTING OVER
            </span>
            <h2>
              Your portfolio.
              <br />
              <span>Meet your new workspace.</span>
            </h2>
          </div>
          <div className="home-start-steps">
            {startupSteps.map(({ icon: Icon, title, text }, i) => (
              <article key={title} data-reveal>
                <div>
                  <Icon size={22} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="home-plan-note" data-reveal>
            <div>
              <span className="home-eyebrow">ROOM FOR YOUR NEXT CHAPTER</span>
              <h3>Start with your portfolio. Grow from there.</h3>
              <p>
                Plan availability and final pricing are being prepared for
                launch.
              </p>
            </div>
            <Link href="/pricing" className="home-button home-button-white">
              View plan availability <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section
          className="home-section home-faq-section"
          aria-labelledby="home-faq-heading"
        >
          <div data-reveal>
            <span className="home-eyebrow">GOOD QUESTIONS. CLEAR ANSWERS.</span>
            <h2 id="home-faq-heading">
              A few things
              <br />
              <span>worth knowing.</span>
            </h2>
            <p>Something else on your mind?</p>
            <Link href="/contact" className="home-text-link">
              Get in touch <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="home-faq-list" data-reveal>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="home-final-cta" data-reveal>
          <div className="home-cta-orbit" aria-hidden="true" />
          <span className="home-eyebrow">MORE ROOM TO BREATHE</span>
          <h2>
            Your properties.
            <br />
            <span>Better connected.</span>
          </h2>
          <p>
            Less scattered information. More of the picture.
            <br />
            Make space for a better way to manage.
          </p>
          <Link href="/register" className="home-button home-button-light">
            Create your workspace <ArrowUpRight size={18} />
          </Link>
          <span className="home-cta-note">
            Built for landlords. Designed around people.
          </span>
        </section>
      </main>
    </PublicLayout>
  );
}
