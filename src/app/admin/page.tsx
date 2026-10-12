import Link from "next/link";
import { notFound } from "next/navigation";
import { adminOverview } from "@/server/admin";
import { PageHeader, Panel, Status } from "@/components/ui";
import { AdminTools, AdminAction } from "@/components/admin-tools";
import { date, money } from "@/lib/calculations";
export default async function Page() {
  let d;
  try {
    d = await adminOverview();
  } catch {
    notFound();
  }
  return (
    <main className="content" id="main">
      <Link href="/app" className="back-link">
        ← Back to workspace
      </Link>
      <PageHeader
        eyebrow="PROTECTED PLATFORM ADMINISTRATION"
        title="Platform control panel"
        description="Operational metadata only. Private tenant messages and documents are excluded."
      />
      <div className="section-links">
        {[
          "organisations",
          "users",
          "subscriptions",
          "plans",
          "compliance",
          "jobs",
          "audit",
          "settings",
        ].map((s) => (
          <a key={s} className="button secondary" href={`#${s}`}>
            {s}
          </a>
        ))}
      </div>
      <div id="organisations">
        <Panel title="Organisations">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Properties</th>
                <th>Members</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {d.organisations.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>{o._count.properties}</td>
                  <td>{o._count.memberships}</td>
                  <td>
                    <Status value={o.status} />
                  </td>
                  <td>
                    <AdminAction
                      action="organisation"
                      id={o.id}
                      data={{
                        status: o.status === "active" ? "suspended" : "active",
                      }}
                      label={o.status === "active" ? "Suspend" : "Reactivate"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div id="users">
        <Panel title="Registered users">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {d.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.emailVerified ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div id="subscriptions">
        <Panel title="Subscription distribution">
          <div className="record-form">
            {d.subscriptions.map((s) => (
              <p key={s.planId + s.status}>
                {d.plans.find((p) => p.id === s.planId)?.name} · {s.status}:{" "}
                {s._count}
              </p>
            ))}
          </div>
        </Panel>
      </div>
      <div id="plans">
        <Panel title="Plan configuration">
          <div className="record-form">
            {d.plans.map((p) => (
              <p key={p.id}>
                <strong>{p.name}</strong> · {money(p.monthlyPence)} monthly ·{" "}
                {p.propertyLimit} properties ·{" "}
                {p.developmentOnly ? "Development only" : "Production"}
              </p>
            ))}
          </div>
        </Panel>
      </div>
      <div id="compliance">
        <Panel title="Compliance rules">
          <div className="record-form">
            {d.rules.length ? (
              d.rules.map((r) => (
                <p key={r.id}>
                  {r.name} · {r.jurisdiction} · v{r.version} ·{" "}
                  {r.active && r.reviewed
                    ? "Active"
                    : "Needs verification / inactive"}
                </p>
              ))
            ) : (
              <p>No rules configured. No legal requirements are assumed.</p>
            )}
          </div>
        </Panel>
      </div>
      <div id="jobs">
        <Panel title="Jobs & email delivery">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last error</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {d.jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.type}</td>
                  <td>
                    <Status value={j.status} />
                  </td>
                  <td>{j.attempts}</td>
                  <td>{j.lastError || "—"}</td>
                  <td>
                    {j.status === "failed" && (
                      <AdminAction
                        action="retry"
                        id={j.id}
                        data={{}}
                        label="Retry job"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div id="audit">
        <Panel title="Audit & security events">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {d.audit.map((a) => (
                <tr key={a.id}>
                  <td>{a.action}</td>
                  <td>{a.actorUserId}</td>
                  <td>{a.resourceType}</td>
                  <td>{date(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div id="settings">
        <AdminTools />
      </div>
    </main>
  );
}
