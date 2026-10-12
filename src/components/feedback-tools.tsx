"use client";
import { useRef, useState } from "react";
import { ClientForm } from "./client-form";
import { obj, str, type Row } from "@/lib/records";
import { requestJson } from "@/lib/http";
import { Panel, Status } from "./ui";

export function FeedbackHistory({ row }: { row: Row }) {
  const data = obj(row.data);
  const history = (data.responses as Row[]) || [];
  return (
    <>
      <Status value={str(row.status)} />
      <p>
        <strong>Type:</strong> {str(data.type)}
        {data.rating ? ` · Satisfaction ${data.rating}/5` : ""}
      </p>
      <p className="preserve-text">{str(data.body)}</p>
      <h3>Landlord responses</h3>
      {history.map((entry) => (
        <div className="message-bubble" key={str(entry.id)}>
          <strong>{str(entry.authorName)}</strong>
          <p className="preserve-text">{str(entry.body)}</p>
          <small>
            <time dateTime={str(entry.createdAt)}>
              {new Date(str(entry.createdAt)).toLocaleString("en-GB", {
                timeZone: "UTC",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              UTC
            </time>
          </small>
        </div>
      ))}
      {!history.length && (
        <p className="preserve-text muted">
          {str(data.response || "No response yet.")}
        </p>
      )}
    </>
  );
}
export function FeedbackResponse({
  row,
  onSaved,
}: {
  row: Row;
  onSaved: () => void;
}) {
  const key = useRef<string | null>(null);
  return (
    <ClientForm
      className="record-form"
      action={async (f) => {
        key.current ??= crypto.randomUUID();
        await requestJson(`/api/feedback/${row.id}/response`, "POST", {
          response: f.get("response"),
          status: f.get("status"),
          idempotencyKey: key.current,
        });
        key.current = null;
        onSaved();
      }}
    >
      <h3>Respond to this feedback</h3>
      <label className="form-field">
        <span>Landlord response</span>
        <textarea
          name="response"
          required
          minLength={1}
          maxLength={5000}
          rows={4}
        />
      </label>
      <label className="form-field">
        <span>Feedback status</span>
        <select
          name="status"
          defaultValue={
            row.status === "draft" ? "in progress" : str(row.status)
          }
        >
          {["draft", "in progress", "completed", "closed", "cancelled"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      <p className="muted small">
        Your response is visible only to the person who submitted this feedback
        and authorised managers. Previous responses remain in the history.
      </p>
      <button className="button primary">Send feedback response</button>
    </ClientForm>
  );
}
export function RepairFeedback({
  repairId,
  reference,
}: {
  repairId: string;
  reference: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <Panel
      title="How was your repair handled?"
      subtitle="Your rating and feedback are private to you and authorised managers."
    >
      {saved ? (
        <p className="record-form success-message" role="status">
          Your repair feedback has been submitted.
        </p>
      ) : (
        <ClientForm
          className="record-form"
          action={async (f) => {
            await requestJson("/api/workspace/feedback", "POST", {
              title: `Feedback for ${reference}`,
              data: {
                type: "repair",
                repairId,
                rating: Number(f.get("rating")),
                body: f.get("body"),
              },
            });
            setSaved(true);
          }}
        >
          <label className="form-field">
            <span>Repair satisfaction</span>
            <select name="rating" required defaultValue="">
              <option value="" disabled>
                Choose a rating
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} out of 5
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Repair feedback</span>
            <textarea
              name="body"
              required
              minLength={5}
              maxLength={10000}
              rows={3}
            />
          </label>
          <button className="button primary">Submit repair feedback</button>
        </ClientForm>
      )}
    </Panel>
  );
}
