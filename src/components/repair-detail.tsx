"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  LockKeyhole,
  Users,
  MessageSquare,
  Clock,
  Download,
  Send,
  CheckCircle2,
  ShieldCheck,
  Paperclip,
} from "lucide-react";
import { PageHeader, Panel, Status } from "./ui";
import { money, date } from "@/lib/calculations";
import { repairStatuses } from "@/lib/config";
import { requestJson } from "@/lib/http";
import { obj, str, type Row } from "./resource-table";
import { DocumentUpload, type Options, NewRecord } from "./record-form";
export function RepairDetail({
  repair: r,
  options,
  tenant,
  editable,
}: {
  repair: Row;
  options: Options;
  tenant: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(path: string, data: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/repairs/${r.id}${path}`, method, data);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const affected = options.tenants.filter((t) =>
    t.participants.some((p) =>
      options.tenancies.some(
        (n) =>
          n.id === p.tenancyId &&
          n.propertyId === obj(r.property).id &&
          (!r.unitId || n.unitId === r.unitId),
      ),
    ),
  );
  const grants = ((r.grants as Row[]) || []).map((g) => str(g.tenantId));
  return (
    <>
      <Link href="/app/repairs" className="back-link">
        <ArrowLeft size={15} />
        Back to repairs
      </Link>
      <PageHeader
        eyebrow={str(r.reference)}
        title={str(r.title)}
        description={`${str(obj(r.property).name)}${r.unit ? ` · ${str(obj(r.unit).name)}` : ""}`}
        action={
          <div className="section-links">
            <Status value={str(r.priority)} />
            <Status value={str(r.status)} />
          </div>
        }
      />
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="repair-status-track">
        {["reported", "acknowledged", "in progress", "resolved", "closed"].map(
          (s, i) => (
            <div
              key={s}
              className={
                repairStatuses.indexOf(
                  r.status as (typeof repairStatuses)[number],
                ) >=
                repairStatuses.indexOf(s as (typeof repairStatuses)[number])
                  ? "done"
                  : ""
              }
            >
              <span>{i + 1}</span>
              <strong>{s}</strong>
            </div>
          ),
        )}
      </div>
      <div className="detail-layout">
        <div>
          <Panel title="The reported issue">
            <div className="record-form">
              <div className="detail-meta">
                <span>{str(r.category)}</span>
                <span>
                  <Clock size={14} />
                  Reported {date(r.createdAt as string)}
                </span>
              </div>
              <p className="preserve-text">{str(r.description)}</p>
              {!!r.completedAt && (
                <div className="form-notice">
                  <CheckCircle2 size={18} />
                  Completed {date(r.completedAt as string)}.{" "}
                  {str(r.completionSummary || "")}
                </div>
              )}
            </div>
          </Panel>
          <Panel
            title="Photographs & attachments"
            action={
              <DocumentUpload
                options={options}
                tenant={tenant}
                fixed={{ repairId: str(r.id) }}
              />
            }
          >
            <div className="attachment-list">
              {((r.documents as Row[]) || []).map((d) => (
                <a key={str(d.id)} href={`/api/documents/${d.id}`}>
                  <Paperclip size={18} />
                  <span>
                    {str(d.name)}
                    <small>{Math.ceil(Number(d.size) / 1024)} KB</small>
                  </span>
                  <Download size={16} />
                </a>
              ))}
              {!((r.documents as Row[]) || []).length && (
                <p className="muted">No authorised attachments yet.</p>
              )}
            </div>
          </Panel>
          <Panel
            title="Conversation"
            subtitle="Updates and questions about this repair"
          >
            <div className="repair-conversation">
              {((r.comments as Row[]) || []).map((c) => (
                <div
                  className={`message-bubble ${!tenant && !c.public ? "internal-bubble" : ""}`}
                  key={str(c.id)}
                >
                  <div>
                    <strong>{str(c.authorName)}</strong>
                    {!tenant && !c.public && (
                      <span className="small-label">
                        <LockKeyhole size={12} />
                        Internal
                      </span>
                    )}
                  </div>
                  <p>{str(c.body)}</p>
                  <small>{date(c.createdAt as string)}</small>
                </div>
              ))}
              {(editable || (tenant && !!r.tenantComments)) && (
                <form
                  action={async (f) => {
                    await act("/comments", {
                      body: f.get("body"),
                      public: tenant || f.get("public") === "on",
                    });
                  }}
                >
                  <textarea
                    name="body"
                    aria-label="Repair message"
                    placeholder={
                      tenant
                        ? "Send a message to your landlord…"
                        : "Add an update or private note…"
                    }
                    required
                    rows={3}
                    maxLength={5000}
                  />
                  <div className="form-footer">
                    {!tenant && (
                      <label className="checkbox-field">
                        <input name="public" type="checkbox" />
                        Visible to authorised tenants
                      </label>
                    )}
                    <button className="button primary" disabled={busy}>
                      <Send size={15} />
                      Send message
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Panel>
          <Panel title="Repair timeline">
            <div className="timeline">
              {((r.updates as Row[]) || []).map((u) => (
                <div key={str(u.id)}>
                  <span className="timeline-dot" />
                  <strong>{str(u.text)}</strong>
                  <small>{date(u.createdAt as string)}</small>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div>
          {editable && (
            <Panel title="Manage repair">
              <form
                className="record-form"
                action={async (f) => {
                  await act(
                    "",
                    {
                      status: f.get("status"),
                      priority: f.get("priority"),
                      targetDate: f.get("targetDate") || null,
                      internalNotes: f.get("internalNotes"),
                      completionSummary: f.get("completionSummary"),
                      tenantComments: f.get("tenantComments") === "on",
                    },
                    "PATCH",
                  );
                }}
              >
                <label className="form-field">
                  <span>Status</span>
                  <select name="status" defaultValue={str(r.status)}>
                    {repairStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Priority</span>
                  <select name="priority" defaultValue={str(r.priority)}>
                    {["low", "normal", "high", "emergency"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Target completion</span>
                  <input
                    name="targetDate"
                    type="date"
                    defaultValue={
                      r.targetDate ? str(r.targetDate).slice(0, 10) : ""
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Private internal notes</span>
                  <textarea
                    name="internalNotes"
                    defaultValue={String(r.internalNotes || "")}
                    rows={3}
                  />
                </label>
                <label className="form-field">
                  <span>Tenant-visible completion summary</span>
                  <textarea
                    name="completionSummary"
                    defaultValue={String(r.completionSummary || "")}
                    rows={3}
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    name="tenantComments"
                    type="checkbox"
                    defaultChecked={!!r.tenantComments}
                  />
                  Allow tenant comments
                </label>
                <button className="button primary full" disabled={busy}>
                  Save changes
                </button>
              </form>
            </Panel>
          )}
          {editable && (
            <Panel
              title="Tenant visibility"
              subtitle="Private by default. You decide who sees it."
            >
              <form
                className="record-form"
                action={async (f) => {
                  await act("/visibility", {
                    visibility: f.get("visibility"),
                    tenantIds: f.getAll("tenantIds"),
                  });
                }}
              >
                <div className="form-notice">
                  <ShieldCheck size={17} />
                  {r.reportedByTenantId
                    ? "The reporting tenant always retains access to their own request. Other access can be revoked."
                    : "Private repairs never appear in a tenant’s portal."}
                </div>
                <label className="form-field">
                  <span>Access</span>
                  <select name="visibility" defaultValue={str(r.visibility)}>
                    <option value="private">
                      Private — owner and authorised staff
                    </option>
                    <option value="selected">Selected tenants</option>
                    <option value="occupants">
                      All affected current occupants
                    </option>
                  </select>
                </label>
                <div className="multi-options">
                  {affected.map((t) => (
                    <label key={t.id}>
                      <input
                        name="tenantIds"
                        type="checkbox"
                        value={t.id}
                        defaultChecked={grants.includes(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
                <button className="button secondary full" disabled={busy}>
                  <Users size={15} />
                  Save tenant access
                </button>
              </form>
            </Panel>
          )}
          {!tenant && "expenses" in r && (
            <Panel
              title="Repair costs"
              action={
                editable && (
                  <NewRecord
                    resource="expenses"
                    options={options}
                    fixed={{ propertyId: obj(r.property).id, repairId: r.id }}
                  />
                )
              }
            >
              <div className="record-form">
                <strong className="cost-total">
                  {money(
                    ((r.expenses as Row[]) || []).reduce(
                      (s, x) => s + Number(x.amountPence),
                      0,
                    ),
                  )}
                </strong>
                <p className="muted small">
                  Costs recorded here are linked to this repair and the property
                  accounts.
                </p>
                {((r.expenses as Row[]) || []).map((e) => (
                  <div className="cost-line" key={str(e.id)}>
                    <span>{str(e.description)}</span>
                    <strong>{money(Number(e.amountPence))}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {tenant && (
            <div className="form-notice">
              <MessageSquare size={18} />
              Your landlord receives your messages. If there is immediate
              danger, use emergency contacts rather than waiting for a portal
              reply.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
