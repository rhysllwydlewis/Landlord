"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/http";
import { Panel } from "./ui";
export function AdminTools() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  async function save(action: string, data: unknown) {
    try {
      await requestJson("/api/admin", "POST", { action, data });
      setSuccess("Configuration saved and audited.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success-message">
          {success}
        </p>
      )}
      <Panel title="Create a subscription plan">
        <form
          className="record-form"
          action={async (f) => {
            await save("plan", {
              name: f.get("name"),
              monthlyPence: Math.round(Number(f.get("monthly")) * 100),
              annualPence: Math.round(Number(f.get("annual")) * 100),
              propertyLimit: Number(f.get("propertyLimit")),
              unitLimit: Number(f.get("unitLimit")),
              staffLimit: Number(f.get("staffLimit")),
              storageBytes: Number(f.get("storage")) * 1024 * 1024,
              features: f.getAll("features"),
              trialDays: Number(f.get("trialDays")),
              active: f.get("active") === "on",
              developmentOnly: f.get("developmentOnly") === "on",
              stripeMonthlyPriceId: f.get("stripeMonthlyPriceId") || undefined,
              stripeAnnualPriceId: f.get("stripeAnnualPriceId") || undefined,
            });
          }}
        >
          <div className="form-grid">
            {[
              ["name", "Plan name", "text"],
              ["monthly", "Monthly price (£)", "number"],
              ["annual", "Annual price (£)", "number"],
              ["propertyLimit", "Property limit", "number"],
              ["unitLimit", "Unit limit", "number"],
              ["staffLimit", "Staff seats", "number"],
              ["storage", "Storage limit (MB)", "number"],
              ["trialDays", "Trial days", "number"],
              ["stripeMonthlyPriceId", "Stripe monthly price ID", "text"],
              ["stripeAnnualPriceId", "Stripe annual price ID", "text"],
            ].map(([name, label, type]) => (
              <label className="form-field" key={name}>
                <span>{label}</span>
                <input
                  name={name}
                  type={type}
                  step={type === "number" ? ".01" : undefined}
                  required={!name.startsWith("stripe")}
                />
              </label>
            ))}
          </div>
          <div className="multi-options">
            {[
              "core",
              "repairs",
              "rent",
              "documents",
              "messages",
              "compliance",
              "finance",
              "operations",
            ].map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  name="features"
                  value={p}
                  defaultChecked
                />
                {p}
              </label>
            ))}
          </div>
          <label className="checkbox-field">
            <input type="checkbox" name="active" />
            Active
          </label>
          <label className="checkbox-field">
            <input type="checkbox" name="developmentOnly" />
            Development only
          </label>
          <button className="button primary">Create plan</button>
        </form>
      </Panel>
      <Panel
        title="Add a versioned compliance rule"
        subtitle="Rules require source material and explicit review before activation."
      >
        <form
          className="record-form"
          action={async (f) => {
            await save("rule", {
              name: f.get("name"),
              jurisdiction: f.get("jurisdiction"),
              propertyTypes: String(f.get("propertyTypes"))
                .split(",")
                .map((s) => s.trim()),
              version: Number(f.get("version")),
              effectiveFrom: f.get("effectiveFrom"),
              effectiveTo: f.get("effectiveTo") || undefined,
              sourceUrl: f.get("sourceUrl"),
              instructions: f.get("instructions"),
              reviewed: f.get("reviewed") === "on",
              active: f.get("active") === "on",
            });
          }}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Rule name</span>
              <input name="name" required />
            </label>
            <label className="form-field">
              <span>Jurisdiction</span>
              <select name="jurisdiction">
                {["England", "Wales", "Scotland", "Northern Ireland"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label className="form-field">
              <span>Property types (comma separated)</span>
              <input
                name="propertyTypes"
                defaultValue="house, flat, HMO"
                required
              />
            </label>
            <label className="form-field">
              <span>Version</span>
              <input
                name="version"
                type="number"
                defaultValue={1}
                min={1}
                required
              />
            </label>
            <label className="form-field">
              <span>Effective from</span>
              <input name="effectiveFrom" type="date" required />
            </label>
            <label className="form-field">
              <span>Effective until (optional)</span>
              <input name="effectiveTo" type="date" />
            </label>
            <label className="form-field wide">
              <span>Source URL</span>
              <input name="sourceUrl" type="url" required />
            </label>
            <label className="form-field wide">
              <span>Administrative instructions</span>
              <textarea name="instructions" minLength={20} required rows={4} />
            </label>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" name="reviewed" />
            Source and rule reviewed
          </label>
          <label className="checkbox-field">
            <input type="checkbox" name="active" />
            Activate rule
          </label>
          <button className="button primary">Save rule version</button>
        </form>
      </Panel>
      <Panel title="Feature flags">
        <form
          className="record-form inline-form"
          action={async (f) =>
            save("setting", {
              key: f.get("key"),
              enabled: f.get("enabled") === "on",
            })
          }
        >
          <input
            name="key"
            placeholder="Flag key"
            aria-label="Feature flag key"
            required
            pattern="[a-z0-9_.-]{3,100}"
          />
          <label className="checkbox-field">
            <input type="checkbox" name="enabled" />
            Enabled
          </label>
          <button className="button secondary">Save flag</button>
        </form>
      </Panel>
    </>
  );
}
export function AdminAction({
  action,
  id,
  data,
  label,
}: {
  action: string;
  id: string;
  data: unknown;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button secondary"
        onClick={async () => {
          if (confirm(`${label}? This operational action is audited.`))
            try {
              await requestJson("/api/admin", "POST", { action, id, data });
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
        }}
      >
        {label}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
