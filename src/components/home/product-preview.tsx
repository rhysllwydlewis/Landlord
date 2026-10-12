"use client";
import { useHydrated } from "../use-hydrated";
import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUpRight,
  Building2,
  House,
  LayoutDashboard,
  Wrench,
  CirclePoundSterling,
  ShieldCheck,
  Users,
  Files,
  ChevronDown,
  Bell,
  MoreHorizontal,
  Check,
  LockKeyhole,
} from "lucide-react";
const navigation = [
  [LayoutDashboard, "Overview"],
  [House, "Properties"],
  [Users, "Tenancies"],
  [CirclePoundSterling, "Rent & payments"],
  [Wrench, "Repairs"],
  [ShieldCheck, "Compliance"],
  [Files, "Documents"],
] as const;
function IncomeChart() {
  return (
    <div className="home-demo-chart">
      <div className="home-demo-chart-heading">
        <div>
          <strong>Rent recorded</strong>
          <span>Your income, in perspective</span>
        </div>
        <span className="home-demo-muted">
          Last six months <ChevronDown size={10} />
        </span>
      </div>
      <div className="home-demo-chart-body">
        <div className="home-chart-axis">
          <span>£9k</span>
          <span>£6k</span>
          <span>£3k</span>
        </div>
        <div className="home-chart-bars">
          {[55, 67, 63, 79, 73, 94].map((height, i) => (
            <div key={i}>
              <span
                className={i === 5 ? "home-chart-bar-latest" : ""}
                style={{ height: `${height}%` }}
              />
              <small>{["May", "Jun", "Jul", "Aug", "Sep", "Oct"][i]}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export function ProductPreview() {
  return (
    <div className="home-product-window glass">
      <div className="home-product-titlebar">
        <div className="home-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>
          <LockKeyhole size={9} /> Your property workspace
        </span>
        <span className="home-window-user">JL</span>
      </div>
      <div className="home-product-body">
        <aside className="home-product-sidebar" aria-hidden="true">
          <div className="home-demo-logo">
            <Building2 size={21} />
            <span>
              Your workspace<small>PORTFOLIO MANAGEMENT</small>
            </span>
          </div>
          <div className="home-demo-nav">
            {navigation.map(([Icon, label], i) => (
              <span key={label} className={i === 0 ? "demo-nav-active" : ""}>
                <Icon size={14} />
                {label}
              </span>
            ))}
          </div>
          <div className="home-demo-support">
            <span className="home-window-user">JL</span>
            <div>
              Jamie’s portfolio<small>Organisation owner</small>
            </div>
          </div>
        </aside>
        <div className="home-product-main">
          <div className="home-demo-heading">
            <div>
              <span className="home-demo-eyebrow">
                YOUR PORTFOLIO AT A GLANCE
              </span>
              <h3>A good day to be organised.</h3>
            </div>
            <Bell size={15} aria-hidden="true" />
          </div>
          <div className="home-demo-stats">
            {[
              ["Properties", "8", "Across your portfolio"],
              ["Rent recorded", "£8,450", "This month"],
              ["Open repairs", "3", "Keep things moving"],
            ].map(([label, value, detail]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <IncomeChart />
          <div className="home-demo-repair-row">
            <span className="home-demo-repair-icon">
              <Wrench size={16} />
            </span>
            <div>
              <strong>Kitchen tap leaking</strong>
              <small>12 Willow Road · Room 1</small>
            </div>
            <span className="home-status">In progress</span>
            <ArrowUpRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
const features = [
  {
    label: "Portfolio",
    icon: House,
    eyebrow: "THE BIG PICTURE. THE IMPORTANT DETAILS.",
    title: "A home for every property.",
    text: "Single lets, HMOs, rooms and units. Keep your properties and tenancies connected, with the details where you need them.",
    benefit: "One organised view of your rental business.",
  },
  {
    label: "Rent",
    icon: CirclePoundSterling,
    eyebrow: "LESS GUESSWORK. A CLEARER LEDGER.",
    title: "Every payment has its place.",
    text: "Record received rent, allocate partial payments and see outstanding balances. A manual ledger that works without a payment provider.",
    benefit: "Know what’s recorded and what needs attention.",
  },
  {
    label: "Repairs",
    icon: Wrench,
    eyebrow: "FROM FIRST REPORT TO FINAL UPDATE.",
    title: "Keep every repair moving.",
    text: "Receive tenant reports, log your own maintenance and keep a clear record of progress. Landlord-created repairs start private.",
    benefit: "The right updates. For the right people.",
  },
  {
    label: "Documents",
    icon: Files,
    eyebrow: "LESS SEARCHING. MORE FINDING.",
    title: "Your paperwork, in order.",
    text: "Connect documents to properties and tenancies. Keep files private or share access deliberately with selected tenants and property owners.",
    benefit: "Control who sees what, file by file.",
  },
] as const;
function TourPanel({ feature }: { feature: number }) {
  if (feature === 0)
    return (
      <div className="home-tour-portfolio">
        <div className="home-tour-preview-heading">
          <div>
            <span>YOUR PORTFOLIO</span>
            <h3>Good places. Well managed.</h3>
          </div>
          <House size={20} />
        </div>
        <div className="home-tour-property-grid">
          {[
            ["/images/living-space.webp", "12 Willow Road", "HMO · 4 rooms"],
            [
              "/images/property-exterior.webp",
              "8 Park Avenue",
              "House · 3 bedrooms",
            ],
          ].map(([src, name, detail]) => (
            <div key={name} className="home-tour-property">
              <div className="home-tour-property-image">
                <Image
                  src={src}
                  fill
                  sizes="(max-width: 600px) 40vw, 260px"
                  alt=""
                />
                <span className="home-status">Occupied</span>
              </div>
              <div>
                <h4>{name}</h4>
                <span>{detail}</span>
                <div>
                  <small>
                    <Users size={11} /> Tenancy linked
                  </small>
                  <ArrowUpRight size={15} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="home-tour-summary">
          <span>
            <Building2 size={14} /> Properties and rooms, connected.
          </span>
          <span>
            <Check size={13} /> One portfolio view
          </span>
        </div>
      </div>
    );
  if (feature === 1)
    return (
      <div className="home-tour-ledger">
        <div className="home-tour-preview-heading">
          <div>
            <span>RENT & PAYMENTS</span>
            <h3>A balance you can follow.</h3>
          </div>
          <CirclePoundSterling size={20} />
        </div>
        <div className="home-tour-rent-summary">
          <span>October rent · 12 Willow Road</span>
          <strong>
            £250<small>Outstanding balance</small>
          </strong>
          <div className="home-payment-track">
            <i />
          </div>
          <div>
            <span>£600 recorded</span>
            <span>£850 due</span>
          </div>
        </div>
        <div className="home-tour-transaction">
          <span className="home-demo-repair-icon">
            <ArrowUpRight size={16} />
          </span>
          <div>
            <strong>Manual payment recorded</strong>
            <span>Bank transfer · allocated to October rent</span>
          </div>
          <strong>£600</strong>
        </div>
        <div className="home-tour-summary">
          <span>
            <Check size={14} /> Partial payments, clearly allocated.
          </span>
        </div>
      </div>
    );
  if (feature === 2)
    return (
      <div className="home-tour-repairs">
        <div className="home-tour-preview-heading">
          <div>
            <span>REPAIRS & MAINTENANCE</span>
            <h3>A clear view of what’s next.</h3>
          </div>
          <Wrench size={20} />
        </div>
        {(
          [
            [
              "Kitchen tap leaking",
              "12 Willow Road · Tenant reported",
              "In progress",
              false,
            ],
            [
              "Boiler service",
              "8 Park Avenue · Landlord created",
              "Under review",
              true,
            ],
            [
              "Window seal replaced",
              "12 Willow Road · Tenant reported",
              "Resolved",
              false,
            ],
          ] as const
        ).map(([title, detail, status, privateRecord]) => (
          <div key={title} className="home-tour-repair">
            <span className="home-demo-repair-icon">
              <Wrench size={15} />
            </span>
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            <div>
              <span className="home-status">{status}</span>
              {privateRecord && (
                <small>
                  <LockKeyhole size={10} />
                  Private
                </small>
              )}
            </div>
          </div>
        ))}
        <div className="home-tour-summary">
          <span>
            <ShieldCheck size={14} /> You choose which repairs tenants can see.
          </span>
        </div>
      </div>
    );
  return (
    <div className="home-tour-documents">
      <div className="home-tour-preview-heading">
        <div>
          <span>YOUR DOCUMENT LIBRARY</span>
          <h3>Everything where it belongs.</h3>
        </div>
        <Files size={20} />
      </div>
      {[
        [
          "Tenancy agreement.pdf",
          "12 Willow Road",
          "Shared with selected tenants",
        ],
        [
          "Gas safety record.pdf",
          "12 Willow Road",
          "Shared with selected tenants",
        ],
        [
          "Insurance policy.pdf",
          "8 Park Avenue",
          "Private to your organisation",
        ],
      ].map(([name, property, access], i) => (
        <div className="home-tour-document" key={name}>
          <span className="home-pdf-icon">PDF</span>
          <div>
            <strong>{name}</strong>
            <span>{property}</span>
          </div>
          <span>
            <i className={i === 2 ? "file-private" : ""} />
            {access}
          </span>
        </div>
      ))}
      <div className="home-tour-summary">
        <span>
          <LockKeyhole size={14} /> Private storage. Deliberate sharing.
        </span>
      </div>
    </div>
  );
}
export function FeatureTour() {
  const hydrated = useHydrated();
  const [selected, setSelected] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % features.length
        : event.key === "ArrowLeft"
          ? (index + features.length - 1) % features.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? features.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }
  return (
    <div className="home-feature-tour">
      <div
        className="home-tour-tabs glass"
        role="tablist"
        aria-label="Explore platform features"
      >
        {features.map((f, i) => (
          <button
            key={f.label}
            ref={(node) => {
              buttons.current[i] = node;
            }}
            type="button"
            disabled={!hydrated}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-controls={`${id}-panel-${i}`}
            aria-selected={selected === i}
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => keyboard(event, i)}
          >
            <f.icon size={17} aria-hidden="true" />
            {f.label}
          </button>
        ))}
      </div>
      {features.map((feature, i) => (
        <div
          className="home-tour-panel"
          key={feature.label}
          hidden={selected !== i}
          id={`${id}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${i}`}
          tabIndex={0}
        >
          <div className="home-tour-copy">
            <span className="home-eyebrow">{feature.eyebrow}</span>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
            <div className="home-tour-benefit">
              <Check size={15} />
              {feature.benefit}
            </div>
          </div>
          <div className="home-tour-preview glass">
            <div className="home-tour-window-top">
              <span className="home-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>Illustrative preview · sample data</span>
              <MoreHorizontal size={16} />
            </div>
            <TourPanel feature={i} />
          </div>
        </div>
      ))}
    </div>
  );
}
