"use client";
import { useState } from "react";
import { requestJson } from "@/lib/http";
export function ApplicationForm({ listingId }: { listingId: string }) {
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return success ? (
    <p className="success-message" role="status">
      {success}
    </p>
  ) : (
    <form
      className="record-form"
      action={async (f) => {
        setBusy(true);
        try {
          await requestJson("/api/applications", "POST", {
            listingId,
            name: f.get("name"),
            email: f.get("email"),
            phone: f.get("phone"),
            message: f.get("message"),
            consent: f.get("consent") === "on",
          });
          setSuccess(
            "Your enquiry has been recorded. The landlord can review it in their workspace.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Enquire about this property</h3>
      <div className="form-grid">
        <label className="form-field">
          <span>Full name</span>
          <input name="name" required minLength={2} />
        </label>
        <label className="form-field">
          <span>Email address</span>
          <input name="email" type="email" required />
        </label>
        <label className="form-field">
          <span>Phone number</span>
          <input name="phone" required maxLength={30} />
        </label>
        <label className="form-field wide">
          <span>Message / viewing preferences</span>
          <textarea name="message" rows={4} maxLength={3000} />
        </label>
      </div>
      <label className="checkbox-field">
        <input name="consent" type="checkbox" required />I understand that this
        enquiry and my contact details will be shared privately with the
        property manager.
      </label>
      <p className="muted small">
        No credit, identity or referencing check is performed by this enquiry.
        Do not send identity documents or sensitive financial details here.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Submitting…" : "Send enquiry"}
      </button>
    </form>
  );
}
