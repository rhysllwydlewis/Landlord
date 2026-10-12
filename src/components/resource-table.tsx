"use client";
import { ClientForm } from "./client-form";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Download,
  Mail,
  Check,
  MessageSquare,
  FileText,
  House,
  Edit2,
} from "lucide-react";
import { modules } from "@/lib/modules";
import {
  date,
  money,
  depositBalance,
  forecast,
  type ForecastInput,
} from "@/lib/calculations";
import { requestJson } from "@/lib/http";
import { Status, Empty } from "./ui";
import { Modal, RecordForm, type Options } from "./record-form";
export type Row = Record<string, unknown>;
export const obj = (x: unknown) =>
  x && typeof x === "object" ? (x as Row) : {};
export const str = (x: unknown) =>
  x === null || x === undefined ? "—" : String(x);
function cell(row: Row, key: string) {
  const v = row[key];
  if (key === "property") return str(obj(v).name);
  if (key === "tenancy") return str(obj(v).reference);
  if (key === "listing") return str(obj(v).title);
  if (key === "participants")
    return ((v as Row[]) || []).map((x) => str(obj(x.tenant).name)).join(", ");
  if (key === "portal")
    return <Status value={row.userId ? "active" : "not invited"} />;
  if (key === "occupancy")
    return (
      <Status
        value={((row.tenancies as Row[]) || []).length ? "occupied" : "vacant"}
      />
    );
  if (key === "rent")
    return money(
      ((row.tenancies as Row[]) || []).reduce(
        (s, t) => s + Number(t.rentPence),
        0,
      ),
    );
  if (key.endsWith("Pence")) return money(Number(v) || 0);
  if (key.endsWith("At") || key.endsWith("Date")) return date(v as string);
  if (["status", "priority", "visibility", "referencingStatus"].includes(key))
    return <Status value={str(v)} />;
  if (key === "reconciled" || key === "published")
    return (
      <Status
        value={
          v
            ? key === "published"
              ? "published"
              : "matched"
            : key === "published"
              ? "draft"
              : "unmatched"
        }
      />
    );
  if (key === "size") return `${Math.ceil(Number(v) / 1024)} KB`;
  if (typeof v === "object") return "—";
  return str(v);
}
export function ResourceTable({
  resource,
  rows,
  options,
  tenant,
  editable,
}: {
  resource: string;
  rows: Row[];
  options: Options;
  tenant: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const m = modules[resource];
  const patch = async (id: string, data: unknown) => {
    setError("");
    try {
      await requestJson(`/api/workspace/${resource}/${id}`, "PATCH", data);
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  if (!rows.length)
    return (
      <Empty
        title={`No ${m.title.toLowerCase()} yet`}
        description={`Your ${m.title.toLowerCase()} will appear here as you add records.`}
      />
    );
  if (resource === "messages")
    return (
      <div className="threads">
        {rows.map((r) => (
          <section key={str(r.id)} className="thread">
            <div className="thread-heading">
              <MessageSquare size={20} />
              <div>
                <h3>{str(r.subject)}</h3>
                <small>{str(obj(r.tenancy).reference)}</small>
              </div>
            </div>
            <MessageHistory
              conversationId={str(r.id)}
              recent={r.messages as Row[]}
            />
            <ClientForm
              action={async (f) => {
                return patch(str(r.id), { body: String(f.get("body")) });
              }}
              className="reply-form"
            >
              <input
                name="body"
                aria-label="Reply"
                placeholder="Write a reply…"
                required
                maxLength={10000}
              />
              <button className="button primary">Send</button>
              <button
                type="button"
                className="button secondary"
                onClick={() => patch(str(r.id), { read: true })}
              >
                Mark read
              </button>
            </ClientForm>
          </section>
        ))}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <>
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {m.columns
                .filter((c) => !(tenant && c === "visibility"))
                .map((c) => (
                  <th key={c}>
                    {c
                      .replace(/Pence$/, "")
                      .replace(/([A-Z])/g, " $1")
                      .replace("created At", "Reported on")}
                  </th>
                ))}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={str(r.id)}>
                {m.columns
                  .filter((c) => !(tenant && c === "visibility"))
                  .map((key, i) => (
                    <td key={key} className={i === 0 ? "primary-cell" : ""}>
                      {i === 0 &&
                      ["properties", "repairs"].includes(resource) ? (
                        <Link href={`/app/${resource}/${r.id}`}>
                          {resource === "properties" && (
                            <span className="table-property-icon">
                              <House size={18} />
                            </span>
                          )}
                          {cell(r, key)}
                        </Link>
                      ) : (
                        cell(r, key)
                      )}
                    </td>
                  ))}
                <td className="row-actions">
                  {["properties", "repairs"].includes(resource) && (
                    <Link
                      className="icon-button"
                      aria-label={`Open ${str(r.title || r.name || r.reference)}`}
                      href={`/app/${resource}/${r.id}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  )}
                  {resource === "documents" && (
                    <>
                      <a
                        className="icon-button"
                        aria-label={`Download ${str(r.name)}`}
                        href={`/api/documents/${r.id}`}
                      >
                        <Download size={17} />
                      </a>
                      {editable && (
                        <button
                          className="icon-button"
                          aria-label="Change document sharing"
                          onClick={() => {
                            setSelected(r);
                            setMode("share");
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                  {resource === "tenants" && editable && !r.userId && (
                    <button
                      className="button table-button"
                      onClick={() => {
                        setSelected(r);
                        setMode("invite");
                      }}
                    >
                      <Mail size={14} />
                      Invite
                    </button>
                  )}
                  {resource === "tenancies" && editable && (
                    <button
                      className="button table-button"
                      onClick={() => {
                        setSelected(r);
                        setMode("rent-change");
                      }}
                    >
                      Rent change
                    </button>
                  )}
                  {resource === "tenancies" && editable && (
                    <select
                      aria-label="Change tenancy status"
                      value={str(r.status)}
                      onChange={(e) => {
                        if (
                          confirm(`Change this tenancy to ${e.target.value}?`)
                        )
                          patch(str(r.id), { status: e.target.value });
                      }}
                    >
                      {["active", "periodic", "ending", "ended"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {resource === "tasks" &&
                    editable &&
                    r.status !== "completed" && (
                      <button
                        className="button table-button"
                        onClick={() =>
                          patch(str(r.id), { status: "completed" })
                        }
                      >
                        <Check size={14} />
                        Complete
                      </button>
                    )}
                  {resource === "expenses" && editable && (
                    <button
                      className="button table-button"
                      onClick={() =>
                        patch(str(r.id), { reconciled: !r.reconciled })
                      }
                    >
                      {r.reconciled ? "Unmatch" : "Reconcile"}
                    </button>
                  )}
                  {resource === "deposits" && editable && (
                    <a
                      className="icon-button"
                      aria-label="Download deposit evidence pack"
                      href={`/api/deposits/${r.id}/evidence`}
                    >
                      <Download size={16} />
                    </a>
                  )}
                  {resource === "deposits" && editable && (
                    <button
                      className="icon-button"
                      aria-label="Edit deposit"
                      onClick={() => {
                        setSelected(r);
                        setMode("deposit");
                      }}
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {resource === "listings" && (
                    <>
                      <a
                        className="icon-button"
                        aria-label="View listing"
                        href={`/listings/${r.slug}`}
                      >
                        <ArrowUpRight size={17} />
                      </a>
                      {editable && (
                        <button
                          className="button table-button"
                          onClick={() =>
                            patch(str(r.id), { published: !r.published })
                          }
                        >
                          {r.published ? "Unpublish" : "Publish"}
                        </button>
                      )}
                    </>
                  )}
                  {resource === "applications" && editable && (
                    <select
                      aria-label="Application status"
                      value={str(r.status)}
                      onChange={(e) =>
                        patch(str(r.id), { status: e.target.value })
                      }
                    >
                      {[
                        "enquiry",
                        "viewing scheduled",
                        "applied",
                        "under review",
                        "accepted",
                        "declined",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {[
                    "inventories",
                    "transitions",
                    "improvements",
                    "feedback",
                    "passport",
                    "forecasts",
                    "bank",
                    "guarantors",
                  ].includes(resource) && (
                    <button
                      className="button table-button"
                      onClick={() => {
                        setSelected(r);
                        setMode("detail");
                      }}
                    >
                      <FileText size={14} />
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <Modal
          title={
            mode === "invite"
              ? "Invite tenant"
              : mode === "share"
                ? "Document sharing"
                : mode === "deposit"
                  ? "Deposit record"
                  : str(selected.title)
          }
          onClose={() => setSelected(null)}
        >
          {mode === "invite" ? (
            <ClientForm
              className="record-form"
              action={async () => {
                setBusy(true);
                try {
                  await requestJson("/api/invitations", "POST", {
                    email: selected.email,
                    role: "TENANT",
                    tenantId: selected.id,
                  });
                  setSelected(null);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Send a secure invitation to{" "}
                <strong>{str(selected.email)}</strong>. They must verify their
                own email before accepting it.
              </p>
              <button className="button primary" disabled={busy}>
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </ClientForm>
          ) : mode === "share" ? (
            <ClientForm
              className="record-form"
              action={async (f) => {
                try {
                  await requestJson(`/api/documents/${selected.id}`, "PATCH", {
                    tenantIds: f.getAll("tenantIds"),
                    ownerVisible: f.get("ownerVisible") === "on",
                  });
                  setSelected(null);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p>
                Select every tenant who should have access. Leaving all boxes
                unchecked makes the file private.
              </p>
              <label className="checkbox-field">
                <input
                  name="ownerVisible"
                  type="checkbox"
                  defaultChecked={!!selected.ownerVisible}
                />
                Allow authorised property owners to access this file
              </label>
              <div className="multi-options">
                {options.tenants.map((t) => (
                  <label key={t.id}>
                    <input
                      name="tenantIds"
                      type="checkbox"
                      value={t.id}
                      defaultChecked={(
                        (selected.grants as { tenantId: string }[]) || []
                      ).some((g) => g.tenantId === t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
              <button className="button primary">Save access</button>
            </ClientForm>
          ) : mode === "rent-change" ? (
            <ClientForm
              className="record-form"
              action={async (f) => {
                try {
                  await requestJson(
                    `/api/workspace/tenancies/${selected.id}`,
                    "PATCH",
                    {
                      rentPence: Math.round(Number(f.get("rent")) * 100),
                      effectiveFrom: f.get("effective"),
                      reason: f.get("reason"),
                      requirementsReviewed: f.get("reviewed") === "on",
                    },
                  );
                  setSelected(null);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div className="form-notice">
                Check the jurisdiction, tenancy terms and applicable rent-change
                procedure before recording a change. This does not issue legal
                notices.
              </div>
              <label className="form-field">
                <span>New rent amount (£)</span>
                <input
                  name="rent"
                  type="number"
                  step=".01"
                  defaultValue={Number(selected.rentPence) / 100}
                  required
                />
              </label>
              <label className="form-field">
                <span>Effective from</span>
                <input name="effective" type="date" required />
              </label>
              <label className="form-field">
                <span>Reason / notice record</span>
                <textarea name="reason" required minLength={5} />
              </label>
              <label className="checkbox-field">
                <input name="reviewed" type="checkbox" required />I have
                reviewed the applicable requirements
              </label>
              <button className="button primary">Record rent change</button>
            </ClientForm>
          ) : mode === "deposit" ? (
            <DepositForm
              row={selected}
              onSave={async (data) => {
                if (await patch(str(selected.id), data)) setSelected(null);
              }}
            />
          ) : (
            <div className="record-form">
              <OperationDetail resource={resource} row={selected} />
              {tenant && resource === "inventories" && (
                <ClientForm
                  className="inline-form"
                  action={async (f) => {
                    if (
                      await patch(str(selected.id), {
                        acknowledge: true,
                        comment: f.get("comment"),
                      })
                    )
                      setSelected(null);
                  }}
                >
                  <input
                    name="comment"
                    placeholder="Your condition comments"
                    aria-label="Inventory comments"
                  />
                  <button className="button primary">
                    Acknowledge inventory
                  </button>
                </ClientForm>
              )}
              {editable && (
                <>
                  <hr />
                  <h3>Edit record</h3>
                  <RecordForm
                    resource={resource}
                    options={options}
                    tenant={tenant}
                    initial={selected}
                    editId={str(selected.id)}
                    onClose={() => setSelected(null)}
                  />
                  <button
                    className="button secondary"
                    onClick={async () => {
                      if (
                        await patch(str(selected.id), { status: "completed" })
                      )
                        setSelected(null);
                    }}
                  >
                    Mark completed
                  </button>
                </>
              )}
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
function MessageHistory({
  conversationId,
  recent,
}: {
  conversationId: string;
  recent: Row[];
}) {
  const [history, setHistory] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(recent.length === 50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messages = [
    ...new Map([...history, ...recent].map((m) => [str(m.id), m])).values(),
  ];
  return (
    <div className="message-list">
      {hasMore && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await requestJson<{
                messages: Row[];
                hasMore: boolean;
              }>(
                `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(str(messages[0]?.id))}`,
                "GET",
              );
              setHistory([...result.messages, ...messages]);
              setHasMore(result.hasMore);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading…" : "Load earlier messages"}
        </button>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {messages.map((message) => (
        <div key={str(message.id)} className="message-bubble">
          <strong>{str(message.senderName)}</strong>
          <p>{str(message.body)}</p>
          <small>{date(message.createdAt as string)}</small>
        </div>
      ))}
    </div>
  );
}
function DepositForm({
  row,
  onSave,
}: {
  row: Row;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [deductions, setDeductions] = useState(
    (row.deductions as {
      description: string;
      amountPence: number;
      accepted: boolean;
      tenantResponse: string;
      documentIds: string[];
    }[]) || [],
  );
  return (
    <ClientForm
      className="record-form"
      action={async (f) => {
        await onSave({
          scheme: f.get("scheme"),
          reference: f.get("reference"),
          status: f.get("status"),
          receivedAt: f.get("receivedAt") || undefined,
          returnedPence: Math.round(Number(f.get("returned")) * 100),
          notes: f.get("notes"),
          deductions,
        });
      }}
    >
      <div className="form-notice">
        Scheme information is a landlord-entered record. It is not confirmation
        from a deposit protection provider.
      </div>
      <div className="form-grid">
        <label className="form-field">
          <span>Scheme</span>
          <input
            name="scheme"
            defaultValue={str(row.scheme) === "—" ? "" : str(row.scheme)}
          />
        </label>
        <label className="form-field">
          <span>Reference</span>
          <input
            name="reference"
            defaultValue={str(row.reference) === "—" ? "" : str(row.reference)}
          />
        </label>
        <label className="form-field">
          <span>Received date</span>
          <input
            name="receivedAt"
            type="date"
            defaultValue={
              row.receivedAt ? str(row.receivedAt).slice(0, 10) : ""
            }
          />
        </label>
        <label className="form-field">
          <span>Status</span>
          <select name="status" defaultValue={str(row.status)}>
            {[
              "not recorded",
              "received",
              "scheme recorded",
              "return in progress",
              "returned",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Amount returned (£)</span>
          <input
            name="returned"
            type="number"
            step=".01"
            min="0"
            defaultValue={Number(row.returnedPence) / 100}
          />
        </label>
        <label className="form-field wide">
          <span>Notes and prescribed information record</span>
          <textarea name="notes" defaultValue={String(row.notes || "")} />
        </label>
      </div>
      <h3>Proposed deductions</h3>
      {deductions.map((d, i) => (
        <div key={i} className="deduction-input">
          <input
            aria-label="Deduction description"
            value={d.description}
            onChange={(e) =>
              setDeductions(
                deductions.map((x, n) =>
                  n === i ? { ...x, description: e.target.value } : x,
                ),
              )
            }
          />
          <input
            aria-label="Deduction amount in pounds"
            type="number"
            step=".01"
            value={d.amountPence / 100}
            onChange={(e) =>
              setDeductions(
                deductions.map((x, n) =>
                  n === i
                    ? {
                        ...x,
                        amountPence: Math.round(Number(e.target.value) * 100),
                      }
                    : x,
                ),
              )
            }
          />
          <label>
            <input
              type="checkbox"
              checked={d.accepted}
              onChange={(e) =>
                setDeductions(
                  deductions.map((x, n) =>
                    n === i ? { ...x, accepted: e.target.checked } : x,
                  ),
                )
              }
            />
            Agreed
          </label>
          <input
            aria-label="Tenant response"
            placeholder="Tenant response"
            value={d.tenantResponse}
            onChange={(e) =>
              setDeductions(
                deductions.map((x, n) =>
                  n === i ? { ...x, tenantResponse: e.target.value } : x,
                ),
              )
            }
          />
        </div>
      ))}
      <button
        className="button secondary"
        type="button"
        onClick={() =>
          setDeductions([
            ...deductions,
            {
              description: "",
              amountPence: 0,
              accepted: false,
              tenantResponse: "",
              documentIds: [],
            },
          ])
        }
      >
        Add deduction
      </button>
      <p className="muted">
        Balance after agreed deductions:{" "}
        {money(
          depositBalance(
            Number(row.amountPence),
            Number(row.returnedPence),
            deductions,
          ),
        )}
      </p>
      <div className="form-footer">
        <button className="button primary">Save deposit record</button>
      </div>
    </ClientForm>
  );
}
export function OperationDetail({
  resource,
  row,
}: {
  resource: string;
  row: Row;
}) {
  const d = obj(row.data);
  if (resource === "forecasts") {
    const f = forecast(d as ForecastInput);
    return (
      <>
        <div className="stats-grid two">
          <div className="stat-card">
            <span>Annual cash flow</span>
            <strong className="stat-value">{money(f.cashflowPence)}</strong>
          </div>
          <div className="stat-card">
            <span>Net rental yield</span>
            <strong className="stat-value">{f.netYield.toFixed(2)}%</strong>
          </div>
        </div>
        <p>
          Gross yield {f.grossYield.toFixed(2)}% · Return on cash invested{" "}
          {f.roi.toFixed(2)}%. Based on {str(d.vacancyPercent)}% vacancy and{" "}
          {str(d.growthPercent)}% annual rental growth.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Cash flow</th>
            </tr>
          </thead>
          <tbody>
            {f.years.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{money(y.incomePence)}</td>
                <td>{money(y.expensesPence)}</td>
                <td>{money(y.incomePence - y.expensesPence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  if (resource === "inventories")
    return (
      <>
        <p>
          {str(d.type)} · {date(d.date as string)}
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Item</th>
              <th>Condition</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(d.items as Row[]).map((x, i) => (
              <tr key={i}>
                <td>{str(x.room)}</td>
                <td>{str(x.item)}</td>
                <td>
                  <Status value={str(x.condition)} />
                </td>
                <td>{str(x.notes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Meter readings: {str(d.meterReadings)}
          <br />
          Keys: {str(d.keys)}
        </p>
      </>
    );
  if (resource === "transitions")
    return (
      <>
        <p>
          {str(d.type)} · {date(d.date as string)}
        </p>
        {(d.checklist as Row[]).map((x, i) => (
          <div className="checklist-row" key={i}>
            <span>{x.completed ? "✓" : "○"}</span>
            {str(x.label)}
          </div>
        ))}
      </>
    );
  return (
    <dl className="detail-grid">
      {Object.entries(d)
        .filter(([k]) => k !== "documentIds")
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k.replace(/([A-Z])/g, " $1").replace(" Pence", "")}</dt>
            <dd>
              {k.endsWith("Pence")
                ? money(Number(v))
                : typeof v === "boolean"
                  ? v
                    ? "Yes"
                    : "No"
                  : str(v)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
