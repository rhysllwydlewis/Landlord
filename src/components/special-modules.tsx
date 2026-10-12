import Link from "next/link";
import {
  House,
  Wrench,
  CirclePoundSterling,
  Files,
  ArrowUpRight,
  Download,
  Bell,
} from "lucide-react";
import { permit, type Context } from "@/server/context";
import { db } from "@/server/db";
import { options, dashboard, can } from "@/server/dashboard";
import { financialReport } from "@/server/reports";
import { repairWhere } from "@/server/repairs";
import { PageHeader, Panel, Status, Empty } from "./ui";
import {
  SettingsForm,
  TeamTools,
  BillingButtons,
  MarkNotifications,
} from "./settings-tools";
import { ImportTool } from "./import-tool";
import { money, date } from "@/lib/calculations";
import { modules } from "@/lib/modules";
import { integrations } from "@/lib/config";
export async function SpecialModule({
  module,
  ctx,
  search,
}: {
  module: string;
  ctx: Context;
  search: Record<string, string | undefined>;
}) {
  if (module === "operations")
    return (
      <>
        <PageHeader
          eyebrow="CONNECTED TOOLS"
          title="A place for every part of your portfolio"
          description="Go a little deeper into property operations and planning."
        />
        <div className="tools-grid">
          {[
            "inventories",
            "deposits",
            "transitions",
            "assets",
            "improvements",
            "forecasts",
            "feedback",
            "passport",
            "guarantors",
            "bank",
          ]
            .filter((key) => can(ctx, modules[key].permission))
            .map((key) => (
              <Link key={key} className="tool-card" href={`/app/${key}`}>
                <span className="feature-icon">
                  {key === "assets" ? (
                    <Wrench size={22} />
                  ) : key === "forecasts" ? (
                    <CirclePoundSterling size={22} />
                  ) : (
                    <Files size={22} />
                  )}
                </span>
                <h2>{modules[key].title}</h2>
                <p>{modules[key].description}</p>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          {ctx.role === "OWNER" && (
            <>
              <Link className="tool-card" href="/app/imports">
                <Download />
                <h2>Import & export</h2>
                <p>
                  Bring your spreadsheets into a validated, persistent workflow.
                </p>
              </Link>
              <Link className="tool-card" href="/app/team">
                <House />
                <h2>Team & access</h2>
                <p>Invite colleagues and read-only property owners.</p>
              </Link>
            </>
          )}
        </div>
      </>
    );
  if (module === "settings") {
    const preference = await db.operationRecord.findUnique({
      where: { id: `preferences:${ctx.userId}:${ctx.organisationId}` },
    });
    const org = await db.organisation.findUniqueOrThrow({
      where: { id: ctx.organisationId },
      select: { name: true },
    });
    return (
      <>
        <PageHeader
          title="Settings"
          description="Your profile, organisation and connected services."
          action={
            ctx.role === "OWNER" && (
              <Link className="button primary" href="/app/billing">
                Subscription & billing
              </Link>
            )
          }
        />
        <div className="settings-layout">
          <div>
            <SettingsForm
              name={ctx.name}
              organisationName={org.name}
              owner={ctx.role === "OWNER"}
              emailUpdates={
                (preference?.data as { email?: boolean } | undefined)?.email !==
                false
              }
            />
            {ctx.role === "OWNER" && (
              <Panel title="Portfolios & ownership">
                <div className="record-form">
                  <p>Group properties and record their owning entities.</p>
                  <EntityForms />
                </div>
              </Panel>
            )}
          </div>
          <Panel
            title="Connected integrations"
            subtitle="Available providers and manual alternatives"
          >
            <div className="integration-list">
              {integrations.map((i) => (
                <div key={i.id}>
                  <div>
                    <strong>{i.name}</strong>
                    <Status
                      value={
                        i.env.length && i.env.every((v) => !!process.env[v])
                          ? "configured"
                          : "unconfigured"
                      }
                    />
                  </div>
                  <p>{i.manual}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </>
    );
  }
  if (module === "team") {
    permit(ctx, "properties");
    if (ctx.role !== "OWNER")
      return (
        <Panel title="Organisation owner access required">
          <p className="record-form">
            Team changes are restricted to the organisation owner.
          </p>
        </Panel>
      );
    const members = await db.membership.findMany({
      where: {
        organisationId: ctx.organisationId,
        role: { in: ["OWNER", "STAFF", "STAKEHOLDER"] },
      },
      include: { user: { select: { name: true, email: true } } },
    });
    return (
      <>
        <PageHeader
          title="Team & access"
          description="Give the right people the right access."
        />
        <TeamTools
          options={await options(ctx)}
          members={JSON.parse(JSON.stringify(members))}
        />
      </>
    );
  }
  if (module === "billing") {
    if (ctx.role !== "OWNER")
      return (
        <Panel title="Organisation owner access required">
          <p className="record-form">
            Only the organisation owner can manage subscriptions.
          </p>
        </Panel>
      );
    const s = await db.subscription.findUnique({
      where: { organisationId: ctx.organisationId },
      include: { plan: true },
    });
    const plans = await db.subscriptionPlan.findMany({
      where: { active: true, developmentOnly: false },
      select: { id: true, name: true, monthlyPence: true },
    });
    return (
      <>
        <PageHeader
          title="Subscription & billing"
          description="Your SaaS subscription. Tenant rent collection is separate."
        />
        <Panel title={s?.plan.name || "No plan selected"}>
          <div className="record-form">
            <Status value={s?.status || "unconfigured"} />
            <p>
              {s?.plan.developmentOnly
                ? "Development sample configuration · no real charges"
                : s
                  ? money(s.plan.monthlyPence) + " per month"
                  : ""}
            </p>
            <dl className="detail-grid">
              <div>
                <dt>Property limit</dt>
                <dd>{s?.plan.propertyLimit}</dd>
              </div>
              <div>
                <dt>Unit limit</dt>
                <dd>{s?.plan.unitLimit}</dd>
              </div>
              <div>
                <dt>Staff seats</dt>
                <dd>{s?.plan.staffLimit}</dd>
              </div>
              <div>
                <dt>Trial ends</dt>
                <dd>{date(s?.trialEndsAt)}</dd>
              </div>
            </dl>
          </div>
          <BillingButtons
            enabled={
              !!process.env.STRIPE_SECRET_KEY &&
              !!process.env.STRIPE_WEBHOOK_SECRET
            }
            customer={!!s?.stripeCustomerId}
            plans={plans}
          />
        </Panel>
      </>
    );
  }
  if (module === "imports") {
    permit(ctx, "properties", true);
    return (
      <>
        <PageHeader
          title="Import & export"
          description="Bring your records with you. Keep a copy whenever you need it."
        />
        <ImportTool />
        <Panel title="Download your records">
          <div className="record-form export-links">
            {[
              "properties",
              "tenants",
              "tenancies",
              "payments",
              "repairs",
              "expenses",
            ].map((r) => (
              <a
                key={r}
                className="button secondary"
                href={`/api/export?resource=${r}`}
              >
                <Download size={16} />
                {modules[r].title}
              </a>
            ))}
          </div>
        </Panel>
      </>
    );
  }
  if (module === "notifications") {
    const raw = await db.notification.findMany({
      where: { organisationId: ctx.organisationId, userId: ctx.userId },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const notifications = [];
    for (const n of raw) {
      if (n.resourceType === "repair") {
        if (
          ctx.role === "TENANT" &&
          !(await db.repair.findFirst({
            where: { ...repairWhere(ctx), id: n.resourceId || "" },
          }))
        )
          continue;
        if (ctx.role === "STAFF" && !can(ctx, "repairs")) continue;
      }
      notifications.push(n);
    }
    return (
      <>
        <PageHeader
          title="Notification centre"
          description="Updates for your authorised records."
          action={<MarkNotifications />}
        />
        <Panel>
          {notifications.length ? (
            notifications.map((n) => (
              <Link key={n.id} href={n.href} className="notification-row">
                <span className="repair-icon">
                  <Bell size={18} />
                </span>
                <div>
                  <strong>{n.title}</strong>
                  <small>{date(n.createdAt)}</small>
                </div>
                {!n.readAt && <Status value="unread" />}
                <ArrowUpRight size={17} />
              </Link>
            ))
          ) : (
            <Empty
              title="All quiet for now"
              description="Updates will appear as you use the platform."
            />
          )}
        </Panel>
      </>
    );
  }
  if (module === "reports" || module === "owner") {
    let report;
    try {
      report = await financialReport(
        ctx,
        new URLSearchParams(
          Object.entries(search).filter((x): x is [string, string] => !!x[1]),
        ),
      );
    } catch {
      return (
        <Panel title="Financial reports are restricted">
          <p className="record-form">
            Report, financial and rent access are required. Read-only property
            owners must be explicitly granted statement access.
          </p>
        </Panel>
      );
    }
    const d = ctx.role === "OWNER" ? await dashboard(ctx) : null;
    const params = new URLSearchParams(
      Object.entries(search).filter((x): x is [string, string] => !!x[1]),
    );
    return (
      <>
        <PageHeader
          title={
            module === "owner" ? "Owner statements" : "Reports & analytics"
          }
          description="A clear view of income, costs, arrears and portfolio performance."
          action={
            <div className="section-links">
              <a
                className="button secondary"
                href={`/api/export?resource=report&${params}`}
              >
                <Download size={16} />
                CSV
              </a>
              <a
                className="button primary"
                href={`/api/export?resource=report&format=pdf&${params}`}
              >
                Download PDF
              </a>
            </div>
          }
        />
        <Panel>
          <form className="record-form inline-form">
            <label className="form-field">
              <span>From</span>
              <input
                name="from"
                type="date"
                defaultValue={report.from.slice(0, 10)}
              />
            </label>
            <label className="form-field">
              <span>To</span>
              <input
                name="to"
                type="date"
                defaultValue={report.to.slice(0, 10)}
              />
            </label>
            <label className="form-field">
              <span>Property</span>
              <select name="propertyId" defaultValue={search.propertyId || ""}>
                <option value="">All authorised properties</option>
                {(await options(ctx)).properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary">Update report</button>
          </form>
        </Panel>
        <div className="stats-grid">
          {Object.entries(report.totals).map(([k, v]) => (
            <div className="stat-card" key={k}>
              <span className="stat-top">{k.replace("Pence", "")}</span>
              <strong className="stat-value">{money(v)}</strong>
            </div>
          ))}
        </div>
        <Panel title="Property performance" subtitle={report.basis}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Income</th>
                  <th>Expenses</th>
                  <th>Profit / loss</th>
                  <th>Arrears</th>
                  <th>Repairs</th>
                  <th>Compliance due</th>
                  <th>Tenancies</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.property}>
                    <td>{r.property}</td>
                    <td>{money(r.incomePence)}</td>
                    <td>{money(r.expensePence)}</td>
                    <td>{money(r.profitPence)}</td>
                    <td>{money(r.arrearsPence)}</td>
                    <td>{r.repairs}</td>
                    <td>{r.complianceDue}</td>
                    <td>{r.activeTenancies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!report.rows.length && (
            <Empty description="Add properties and transactions to populate your reports." />
          )}
        </Panel>
        {d && (
          <Panel
            title="Financial review signals"
            subtitle="Rules highlight records for review; they do not make allegations or change data."
          >
            <div className="signal-list">
              {d.anomalies.slice(0, 20).map((a) => (
                <div className="signal" key={a.id}>
                  <Status value={a.severity} />
                  <p>{a.reason}</p>
                  <small>Records: {a.relatedIds.join(", ")}</small>
                  <AnomalyReview id={a.id} />
                </div>
              ))}
              {!d.anomalies.length && (
                <p className="muted">No current expense review signals.</p>
              )}
            </div>
          </Panel>
        )}
      </>
    );
  }
  return null;
}
import { EntityForms, AnomalyReview } from "./small-tools";
