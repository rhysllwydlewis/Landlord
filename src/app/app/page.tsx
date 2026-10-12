import Link from "next/link";
import {
  House,
  ArrowUpRight,
  Wrench,
  Plus,
  CirclePoundSterling,
  ShieldCheck,
  Clock,
  ArrowRight,
  KeyRound,
  Building2,
} from "lucide-react";
import { context } from "@/server/context";
import { dashboard, can } from "@/server/dashboard";
import { PageHeader, Panel, Status, Empty, ViewLink } from "@/components/ui";
import { IncomeChart } from "@/components/chart";
import { money, date } from "@/lib/calculations";
export default async function Dashboard() {
  const ctx = await context();
  const d = await dashboard(ctx);
  const tenant = ctx.role === "TENANT";
  const owner = ctx.role === "STAKEHOLDER";
  const s = d.stats;
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());
  const cards = tenant
    ? [
        {
          label: "Outstanding balance",
          value: money(s.outstandingPence),
          icon: CirclePoundSterling,
          note: `${money(s.creditPence)} unapplied credit`,
          tone: s.outstandingPence ? "amber" : "green",
        },
        {
          label: "Next rent due",
          value: d.nextRent ? money(d.nextRent.amountPence) : "—",
          icon: KeyRound,
          note: d.nextRent
            ? date(d.nextRent.dueDate)
            : "No upcoming obligation",
          tone: "green",
        },
        {
          label: "Open repairs",
          value: String(s.openRepairs),
          icon: Wrench,
          note: "Your reports and shared repairs",
          tone: "green",
        },
      ]
    : [
        {
          label: "Total properties",
          value: String(s.properties),
          icon: House,
          note: `${s.occupied} occupied · ${s.vacant} vacant · ${s.units} units`,
          tone: "green",
        },
        ...(can(ctx, "rent")
          ? [
              {
                label: "Rent received",
                value: money(s.receivedPence),
                icon: CirclePoundSterling,
                note: `${money(s.expectedPence)} expected this month`,
                tone: "green",
              },
              {
                label: "Outstanding rent",
                value: money(s.outstandingPence),
                icon: Clock,
                note: `${s.overdue} overdue obligations`,
                tone: s.overdue ? "amber" : "green",
              },
            ]
          : []),
        ...(can(ctx, "repairs")
          ? [
              {
                label: "Open repairs",
                value: String(s.openRepairs),
                icon: Wrench,
                note: `${s.urgentRepairs} need urgent attention`,
                tone: s.urgentRepairs ? "amber" : "green",
              },
            ]
          : []),
      ];
  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`Good ${new Date().getUTCHours() < 12 ? "morning" : "afternoon"}, ${ctx.name.split(" ")[0]}`}
        description={
          tenant
            ? "Here’s what’s happening with your home."
            : owner
              ? "An overview of your authorised properties."
              : "Here’s what’s happening across your portfolio today."
        }
        action={
          <Link
            className="button primary"
            href={tenant ? "/app/repairs?new=1" : "/app/properties?new=1"}
          >
            <Plus size={16} />
            {tenant ? "Report a repair" : "Add property"}
          </Link>
        }
      />
      {s.compliance > 0 && !tenant && (
        <div className="attention-banner">
          <span className="banner-icon">
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>A little attention today goes a long way.</strong>
            <p>
              {s.compliance} compliance records need review
              {s.urgentRepairs
                ? ` and ${s.urgentRepairs} urgent repairs are open`
                : ""}
              .
            </p>
          </div>
          <Link href="/app/compliance">
            Review deadlines <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className={`stats-grid ${tenant ? "three" : ""}`}>
        {cards.map((c) => (
          <section className="stat-card" key={c.label}>
            <div className="stat-top">
              <span>{c.label}</span>
              <c.icon size={19} />
            </div>
            <div className="stat-value">{c.value}</div>
            <div className={`stat-note ${c.tone}`}>
              <span className="status-dot" />
              {c.note}
            </div>
          </section>
        ))}
      </div>
      <div className="dashboard-main">
        <div>
          {(can(ctx, "rent") || tenant) && (
            <Panel
              title={tenant ? "Your payment history" : "Rental income"}
              subtitle="Recorded payments over the last six months"
              action={
                <span className="small-label">
                  Last 6 months <span>⌄</span>
                </span>
              }
            >
              <div className="chart-summary">
                <strong>
                  {money(d.monthly.reduce((a, m) => a + m.incomePence, 0))}
                </strong>
                <span>Total rent received</span>
              </div>
              <IncomeChart data={d.monthly} />
            </Panel>
          )}
          <Panel
            title="Recent repairs"
            subtitle={
              tenant
                ? "Your requests and authorised shared repairs"
                : "Keep an eye on work in progress"
            }
            action={<ViewLink href="/app/repairs" />}
          >
            {d.repairs.length ? (
              <div className="mini-table">
                <div className="mini-table-labels">
                  <span>Repair / property</span>
                  <span>Priority</span>
                  <span>Status</span>
                </div>
                {d.repairs.map((r) => (
                  <Link
                    href={`/app/repairs/${r.id}`}
                    key={r.id}
                    className="repair-row"
                  >
                    <span className="repair-icon">
                      <Wrench size={17} />
                    </span>
                    <span className="repair-name">
                      <strong>{r.title}</strong>
                      <small>{r.property.name}</small>
                    </span>
                    <Status value={r.priority} />
                    <Status value={r.status} />
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="No open repairs"
                description="New reports and shared repairs will appear here."
              />
            )}
          </Panel>
        </div>
        <div>
          {!owner && (
            <Panel
              title="Quick actions"
              subtitle="A shorter route to your next task"
            >
              <div className="quick-actions">
                {(tenant
                  ? [
                      ["Report a repair", "repairs", Wrench],
                      ["Send a message", "messages", MessageSquareIcon],
                      ["Share feedback", "feedback", UsersIcon],
                    ]
                  : (
                      [
                        ["Add property", "properties", House],
                        ["Add tenant", "tenants", UsersIcon],
                        ["Create tenancy", "tenancies", KeyRound],
                        ["Record payment", "payments", CirclePoundSterling],
                        ["Log repair", "repairs", Wrench],
                        ["Add expense", "expenses", CirclePoundSterling],
                        ["Upload document", "documents", FilesIcon],
                        ["Create task", "tasks", Clock],
                      ] as const
                    ).filter((x) =>
                      can(
                        ctx,
                        x[1] === "payments"
                          ? "rent"
                          : x[1] === "expenses"
                            ? "finance"
                            : x[1],
                      ),
                    )
                ).map(([label, slug, Icon]) => (
                  <Link key={String(slug)} href={`/app/${slug}?new=1`}>
                    <Icon size={17} />
                    <span>{String(label)}</span>
                    <Plus size={14} />
                  </Link>
                ))}
              </div>
            </Panel>
          )}
          <Panel
            title={tenant ? "Your tenancy" : "Upcoming deadlines"}
            subtitle={
              tenant
                ? "The essentials, all in one place"
                : "Stay one step ahead"
            }
            action={!tenant && <ViewLink href="/app/tasks">Calendar</ViewLink>}
          >
            {tenant
              ? d.tenancies.slice(0, 2).map((t) => (
                  <div key={t.id} className="deadline">
                    <span className="deadline-icon">
                      <KeyRound size={18} />
                    </span>
                    <div>
                      <strong>{t.reference}</strong>
                      <small>
                        {money(t.rentPence)} · {t.frequency}
                        <br />
                        Started {date(t.startDate)}
                      </small>
                    </div>
                    <Status value={t.status} />
                  </div>
                ))
              : [
                  ...d.compliance.map((c) => ({
                    id: c.id,
                    title: c.title,
                    date: c.expiresAt,
                    type: "compliance",
                  })),
                  ...d.tasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    date: t.dueDate,
                    type: "tasks",
                  })),
                ]
                  .slice(0, 4)
                  .map((t) => (
                    <Link
                      key={t.id}
                      className="deadline"
                      href={`/app/${t.type}`}
                    >
                      <span className="deadline-icon">
                        <ShieldCheck size={17} />
                      </span>
                      <div>
                        <strong>{t.title}</strong>
                        <small>{date(t.date)}</small>
                      </div>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
            {!tenant && !d.compliance.length && !d.tasks.length && (
              <Empty
                title="You’re up to date"
                description="Upcoming tasks and certificate renewals will appear here."
              />
            )}
          </Panel>
          <div className="insight-card">
            <span className="eyebrow">A CLEARER PICTURE</span>
            <Building2 size={27} />
            <h3>
              {tenant
                ? "A home, well managed."
                : "Your portfolio. In perspective."}
            </h3>
            <p>
              {tenant
                ? "Access your tenancy, documents and landlord messages securely."
                : "Bring your property data together and make informed decisions."}
            </p>
            <Link href={tenant ? "/app/documents" : "/app/reports"}>
              {tenant ? "View your documents" : "Explore your reports"}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      {!tenant && (
        <div className="dashboard-bottom">
          <Panel
            title="Portfolio snapshot"
            action={<ViewLink href="/app/properties" />}
          >
            {d.properties.length ? (
              <div className="property-preview-grid">
                {d.properties.slice(0, 3).map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/app/properties/${p.id}`}
                    className="property-preview"
                  >
                    <div className={`property-art art-${i % 3}`}>
                      <House size={43} strokeWidth={1.2} />
                      <span>{p.type}</span>
                    </div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.postcode} · {p.bedrooms} bedrooms
                    </p>
                    <div>
                      <span>EPC {p.epcRating || "not recorded"}</span>
                      <ArrowUpRight size={15} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Your portfolio starts here"
                description="Add a property to begin managing your rental business."
                action={
                  <Link className="button primary" href="/app/properties?new=1">
                    Add your first property
                  </Link>
                }
              />
            )}
          </Panel>
          {can(ctx, "finance") ? (
            <Panel
              title="Income vs expenses"
              subtitle="Based on recorded transactions"
            >
              <IncomeChart data={d.monthly} expenses />
            </Panel>
          ) : (
            <Panel title="Recent activity">
              {d.activity.map((a) => (
                <div className="activity" key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{a.action.replaceAll(".", " ")}</strong>
                    <small>{date(a.createdAt)}</small>
                  </div>
                </div>
              ))}
              {!d.activity.length && (
                <Empty description="Your activity will appear as you use the platform." />
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
import {
  MessageSquare as MessageSquareIcon,
  Users as UsersIcon,
  Files as FilesIcon,
} from "lucide-react";
