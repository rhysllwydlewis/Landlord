"use client";
import { useEffect, useRef, useState } from "react";
import { ClientForm } from "./client-form";
import { obj, str, type Row } from "@/lib/records";
import { requestJson } from "@/lib/http";
import { date, money } from "@/lib/calculations";
import { Status } from "./ui";
export function DepositResponses({
  id,
  tenant,
}: {
  id: string;
  tenant: boolean;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    requestJson(`/api/deposits/${id}/responses`, "GET")
      .then((data) => {
        if (active) setRecord(data as Row);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function refresh() {
    setError("");
    try {
      setRecord(
        (await requestJson(`/api/deposits/${id}/responses`, "GET")) as Row,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!record)
    return (
      <div className="record-form">
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : (
          <p role="status">Loading deposit proposal…</p>
        )}
        <button className="button secondary" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  const deductions = (record.deductions as Row[]) || [];
  const responses = (record.responses as Row[]) || [];
  return (
    <div className="record-form">
      <Status value={str(record.status)} />
      <dl className="detail-grid">
        <div>
          <dt>Deposit recorded</dt>
          <dd>{money(Number(record.amountPence))}</dd>
        </div>
        <div>
          <dt>Returned amount recorded</dt>
          <dd>{money(Number(record.returnedPence))}</dd>
        </div>
        <div>
          <dt>Scheme recorded by landlord</dt>
          <dd>{str(record.scheme || "Not recorded")}</dd>
        </div>
        <div>
          <dt>Scheme reference</dt>
          <dd>{str(record.reference || "Not recorded")}</dd>
        </div>
      </dl>
      <h3>Current deduction proposal</h3>
      {deductions.map((deduction, i) => (
        <div className="message-bubble" key={i}>
          <strong>{str(deduction.description)}</strong>
          <p>
            {money(Number(deduction.amountPence))} ·{" "}
            {deduction.accepted ? "Agreement recorded by landlord" : "Proposed"}
          </p>
        </div>
      ))}
      {!deductions.length && (
        <p className="muted">No deductions have been proposed.</p>
      )}
      <button className="button secondary" onClick={refresh}>
        Refresh proposal
      </button>
      <h3>{tenant ? "Your responses" : "Tenant responses"}</h3>
      {responses.map((response) => (
        <div className="message-bubble" key={str(response.id)}>
          <strong>
            {str(obj(response.tenant).name)} · {str(response.decision)}
          </strong>
          <p className="preserve-text">{str(response.body)}</p>
          <small>
            {date(str(response.createdAt))} ·{" "}
            {response.proposalHash === record.proposalHash
              ? "Current proposal"
              : "Earlier proposal"}
          </small>
        </div>
      ))}
      {!responses.length && <p className="muted">No responses recorded yet.</p>}
      {tenant && (
        <ClientForm
          key={str(record.proposalHash)}
          action={async (f) => {
            setMessage("");
            key.current ??= crypto.randomUUID();
            await requestJson(`/api/deposits/${id}/responses`, "POST", {
              proposalHash: record.proposalHash,
              decision: f.get("decision"),
              body: f.get("body"),
              idempotencyKey: key.current,
            });
            const current = (await requestJson(
              `/api/deposits/${id}/responses`,
              "GET",
            )) as Row;
            key.current = null;
            setRecord(current);
            setMessage("Your deposit response has been recorded.");
            return true;
          }}
          className="record-form"
        >
          <label className="form-field">
            <span>Your position on this proposal</span>
            <select name="decision" defaultValue="question">
              <option value="question">I need clarification</option>
              <option value="agree">I agree with this proposal</option>
              <option value="disagree">I disagree with this proposal</option>
            </select>
          </label>
          <label className="form-field">
            <span>Your deposit response</span>
            <textarea
              name="body"
              minLength={5}
              maxLength={2000}
              rows={4}
              required
            />
          </label>
          <p className="muted small">
            Your response is shared with authorised managers. Other co-tenants
            cannot see it. Your landlord records agreed deductions and returns
            separately.
          </p>
          <button className="button primary">Send deposit response</button>
        </ClientForm>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
