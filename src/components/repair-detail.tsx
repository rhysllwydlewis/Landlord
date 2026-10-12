"use client";
import { ClientForm } from "./client-form";
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
import { RepairFeedback } from "./feedback-tools";
export function RepairDetail({
  repair: r,
  options,
  tenant,
  editable,
  financeEditable,
  documentEditable,
  feedbackEnabled,
}: {
  repair: Row;
  options: Options;
  tenant: boolean;
  editable: boolean;
  financeEditable: boolean;
  documentEditable: boolean;
  feedbackEnabled: boolean;
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
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
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
          ["active", "periodic", "ending"].includes(n.status || "active") &&
          (!r.unitId || n.unitId === null || n.unitId === r.unitId),
      ),
    ),
  );
  const grants = ((r.grants as Row[]) || []).map((g) => str(g.tenantId));
  const progressStage =
    (
      {
        reported: 0,
        acknowledged: 1,
        "under review": 1,
        "in progress": 2,
        "awaiting parts": 2,
        "on hold": 2,
        resolved: 3,
        closed: 4,
        cancelled: 0,
      } as Record<string, number>
    )[str(r.status)] ?? 0;
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
      <div
        className="repair-status-track"
        role="list"
        aria-label="Repair status progression"
      >
        {["reported", "acknowledged", "in progress", "resolved", "closed"].map(
          (s, i) => (
            <div
              key={s}
              role="listitem"
              aria-current={i === progressStage ? "step" : undefined}
              className={i <= progressStage ? "done" : ""}
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
              {!!r.issueStartedAt && (
                <p className="muted small">
                  Issue first noticed {date(str(r.issueStartedAt))}.
                </p>
              )}
              <p className="muted small">
                {r.ongoing
                  ? "Reported as an ongoing issue."
                  : "Reported as an intermittent or past issue."}
              </p>
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
              (tenant || documentEditable) && (
                <DocumentUpload
                  options={options}
                  tenant={tenant}
                  fixed={{ repairId: str(r.id) }}
                />
              )
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
                <ClientForm
                  action={async (f) => {
                    return act("/comments", {
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
                </ClientForm>
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
          {tenant &&
            feedbackEnabled &&
            ["resolved", "closed"].includes(str(r.status)) && (
              <RepairFeedback
                repairId={str(r.id)}
                reference={str(r.reference)}
              />
            )}
        </div>
        <div>
          {editable && (
            <Panel title="Manage repair">
              <ClientForm
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
                      completedAt: ["resolved", "closed"].includes(
                        String(f.get("status")),
                      )
                        ? f.get("completedAt") || undefined
                        : undefined,
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
                  <span>Actual completion date</span>
                  <input
                    name="completedAt"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    defaultValue={
                      r.completedAt ? str(r.completedAt).slice(0, 10) : ""
                    }
                  />
                  <small>
                    Set when resolving or closing a repair. Leave blank to use
                    the recorded date.
                  </small>
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
              </ClientForm>
            </Panel>
          )}
          {editable && (
            <Panel
              title="Tenant visibility"
              subtitle="Private by default. You decide who sees it."
            >
              <ClientForm
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
              </ClientForm>
            </Panel>
          )}
          {!tenant && "expenses" in r && (
            <Panel
              title="Repair costs"
              action={
                financeEditable && (
                  <NewRecord
                    resource="expenses"
                    options={options}
                    fixed={{ propertyId: obj(r.property).id, repairId: r.id }}
                  />
                )
              }
            >
              <div className="record-form">
                <p className="muted small">
                  Estimated cost:{" "}
                  {r.estimatedCostPence == null
                    ? "Not recorded"
                    : money(Number(r.estimatedCostPence))}
                </p>
                {editable && financeEditable && (
                  <ClientForm
                    className="record-form"
                    action={async (f) => {
                      await act(
                        "",
                        {
                          estimatedCostPence:
                            f.get("estimate") === ""
                              ? null
                              : Math.round(Number(f.get("estimate")) * 100),
                        },
                        "PATCH",
                      );
                    }}
                  >
                    <label className="form-field">
                      <span>Estimated repair cost</span>
                      <input
                        name="estimate"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          r.estimatedCostPence == null
                            ? ""
                            : Number(r.estimatedCostPence) / 100
                        }
                      />
                    </label>
                    <button className="button secondary" disabled={busy}>
                      Save estimate
                    </button>
                  </ClientForm>
                )}
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
                    <span>
                      {str(e.description)}
                      <small className="muted">
                        {str(e.supplier || "")}
                        {e.invoiceReference
                          ? ` · Invoice ${e.invoiceReference}`
                          : ""}{" "}
                        · {date(str(e.incurredAt))}
                      </small>
                    </span>
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
              {options.repairGuidance?.emergencyContact && (
                <p>
                  Landlord emergency contact:{" "}
                  {options.repairGuidance.emergencyContact}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
