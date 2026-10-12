import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Download, ArrowRight, ShieldCheck } from "lucide-react";
import { context } from "@/server/context";
import { options, can } from "@/server/dashboard";
import { listResource } from "@/server/resources";
import { modules } from "@/lib/modules";
import { PageHeader, Panel } from "@/components/ui";
import { NewRecord, DocumentUpload } from "@/components/record-form";
import { ResourceTable } from "@/components/resource-table";
import { SpecialModule } from "@/components/special-modules";
import { PassportExport } from "@/components/passport-export";
import { TaskCalendar } from "@/components/task-calendar";
import { InventoryCompare } from "@/components/inventory-compare";
export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const slug = (await params).module;
  const ctx = await context();
  const sp = await searchParams;
  if (
    [
      "operations",
      "reports",
      "team",
      "settings",
      "billing",
      "imports",
      "notifications",
      "owner",
    ].includes(slug)
  )
    return <SpecialModule module={slug} ctx={ctx} search={sp} />;
  const m = modules[slug];
  if (!m) notFound();
  const opt = await options(ctx);
  let list;
  try {
    list = await listResource(
      ctx,
      slug,
      new URLSearchParams(
        Object.entries(sp).filter((x): x is [string, string] => !!x[1]),
      ),
    );
  } catch {
    return (
      <Panel title="Access restricted">
        <p className="record-form">
          This module is not available with your current permissions.{" "}
          <Link href="/app">Return to your dashboard.</Link>
        </p>
      </Panel>
    );
  }
  const tenant = ctx.role === "TENANT";
  const editable = tenant
    ? !!m.tenantCreate
    : ctx.role === "OWNER" ||
      (ctx.role === "STAFF" &&
        ctx.permissions.includes(`${m.permission}:write`));
  const create = editable && m.fields.length > 0;
  return (
    <>
      <PageHeader
        eyebrow={tenant ? "YOUR PORTAL" : "YOUR WORKSPACE"}
        title={m.title}
        description={m.description}
        action={
          slug === "documents" && (editable || tenant) ? (
            <DocumentUpload
              options={opt}
              tenant={tenant}
              startOpen={sp.new === "1"}
            />
          ) : create ? (
            <NewRecord
              resource={slug}
              options={opt}
              tenant={tenant}
              startOpen={sp.new === "1"}
            />
          ) : undefined
        }
      />
      {slug === "rent" && (
        <div className="section-links">
          <Link className="button secondary" href="/app/payments">
            Payment history <ArrowRight size={15} />
          </Link>
          {!tenant && can(ctx, "rent") && (
            <NewRecord resource="payments" options={opt} />
          )}
          <span className="muted small">
            Online collection is unconfigured. Manual payment recording is
            available.
          </span>
        </div>
      )}
      {slug === "listings" && (
        <div className="section-links">
          <Link className="button secondary" href="/app/applications">
            Manage applications <ArrowRight size={15} />
          </Link>
          <span className="muted small">
            External portal publishing requires approved provider access.
          </span>
        </div>
      )}
      {slug === "compliance" && (
        <div className="form-notice">
          <ShieldCheck size={17} />
          Certificate dates are recorded by you. Jurisdiction rules require
          review and a source before automation is enabled.
        </div>
      )}
      {slug === "assets" && (
        <PropertyHealth
          rows={list.rows as Record<string, unknown>[]}
          now={new Date().getTime()}
        />
      )}
      <Panel>
        <div className="table-toolbar">
          <div className="table-tabs">
            <strong>All {m.title.split(" & ")[0].toLowerCase()}</strong>
            <span className="count-pill">{list.total}</span>
          </div>
          <form className="filter-form">
            <div className="input-search">
              <Search size={16} />
              <input
                name="q"
                aria-label="Search records"
                defaultValue={sp.q || ""}
                placeholder="Search…"
              />
            </div>
            {!["passport", "messages"].includes(slug) && (
              <select
                name="propertyId"
                aria-label="Filter by property"
                defaultValue={sp.propertyId || ""}
              >
                <option value="">All properties</option>
                {opt.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {["repairs", "tasks", "tenancies"].includes(slug) && (
              <select
                name="status"
                aria-label="Filter by status"
                defaultValue={sp.status || ""}
              >
                <option value="">All statuses</option>
                {(slug === "repairs"
                  ? [
                      "reported",
                      "acknowledged",
                      "under review",
                      "in progress",
                      "awaiting parts",
                      "on hold",
                      "resolved",
                      "closed",
                      "cancelled",
                    ]
                  : slug === "tasks"
                    ? ["open", "completed", "cancelled"]
                    : ["active", "periodic", "ending", "ended"]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            <button className="button secondary">Filter</button>
          </form>
          {!tenant && can(ctx, "reports") && (
            <a
              href={`/api/export?resource=${slug}&${new URLSearchParams(Object.entries(sp).filter((x): x is [string, string] => !!x[1]))}`}
              className="icon-button"
              aria-label="Export CSV"
            >
              <Download size={17} />
            </a>
          )}
        </div>
        <ResourceTable
          resource={slug}
          rows={JSON.parse(JSON.stringify(list.rows))}
          options={opt}
          tenant={tenant}
          editable={editable}
        />
        <div className="table-footer">
          <span>
            {list.total} records · Page {list.page} of {list.pages}
          </span>
          <div>
            {list.page > 1 && (
              <Link
                className="button secondary"
                href={`?${new URLSearchParams({ ...sp, page: String(list.page - 1) } as Record<string, string>)}`}
              >
                Previous
              </Link>
            )}
            {list.page < list.pages && (
              <Link
                className="button secondary"
                href={`?${new URLSearchParams({ ...sp, page: String(list.page + 1) } as Record<string, string>)}`}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </Panel>
      {slug === "passport" && tenant && <PassportExport />}
      {slug === "tasks" && (
        <TaskCalendar rows={JSON.parse(JSON.stringify(list.rows))} />
      )}{" "}
      {slug === "inventories" && (
        <InventoryCompare rows={JSON.parse(JSON.stringify(list.rows))} />
      )}
    </>
  );
}
function PropertyHealth({
  rows,
  now,
}: {
  rows: Record<string, unknown>[];
  now: number;
}) {
  const alerts = rows.flatMap((r) => {
    const list: string[] = [];
    if (!r.lastServiceAt)
      list.push("No service date recorded — verify servicing requirements.");
    else {
      const next = new Date(String(r.lastServiceAt));
      next.setUTCMonth(next.getUTCMonth() + Number(r.serviceIntervalMonths));
      if (next.getTime() < now)
        list.push("Servicing is overdue based on the recorded interval.");
    }
    if (
      r.replacementAt &&
      new Date(String(r.replacementAt)) < new Date(now + 90 * 86400000)
    )
      list.push("Planned replacement is due within 90 days.");
    return list.map((text) => ({
      id: String(r.id) + text,
      name: String(r.name),
      text,
    }));
  });
  return alerts.length ? (
    <Panel
      title="Preventative maintenance signals"
      subtitle="Transparent estimates from recorded dates and intervals"
    >
      <div className="signal-list">
        {alerts.map((a) => (
          <div className="signal" key={a.id}>
            <strong>{a.name}</strong>
            <p>{a.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  ) : null;
}
