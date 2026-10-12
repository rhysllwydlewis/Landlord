"use client";
import { useState } from "react";
import { modules } from "@/lib/modules";
import { requestJson } from "@/lib/http";
import { Panel, Status } from "./ui";
export function ImportTool() {
  const [type, setType] = useState("properties");
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    id: string;
    valid: boolean;
    preview: { row: number; data: Record<string, unknown>; errors: string[] }[];
  } | null>(null);
  const [result, setResult] = useState("");
  return (
    <Panel
      title="Import a CSV spreadsheet"
      subtitle="Map columns, review the preview, then commit a validated batch."
    >
      <form
        className="record-form"
        action={async (f) => {
          setBusy(true);
          setError("");
          try {
            const mapping: Record<string, string> = {};
            for (const field of modules[type].fields) {
              const column = f.get(`map:${field.name}`);
              if (column) mapping[field.name] = String(column);
            }
            const p = await requestJson<typeof preview>(
              "/api/imports",
              "POST",
              { type, csv, mapping },
            );
            setPreview(p);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Record type</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPreview(null);
              }}
            >
              {[
                "properties",
                "tenants",
                "tenancies",
                "payments",
                "expenses",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    setError("Choose a CSV under 2 MB.");
                    return;
                  }
                  const text = await file.text();
                  setCsv(text);
                  setHeaders(
                    text
                      .replace(/^\uFEFF/, "")
                      .split(/\r?\n/)[0]
                      .split(",")
                      .map((h) => h.replace(/^"|"$/g, "").trim()),
                  );
                  setPreview(null);
                }
              }}
            />
          </label>
        </div>
        <p className="muted small">
          Amounts must be in pounds (e.g. 1250.00); dates use YYYY-MM-DD. Link
          property and tenancy IDs from exports. Separate co-tenant IDs with
          semicolons. Maximum 500 rows. No existing record is overwritten.
        </p>
        {headers.length > 0 && (
          <div className="mapping-grid">
            {modules[type].fields.map((f) => (
              <label className="form-field" key={f.name}>
                <span>
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                <select
                  name={`map:${f.name}`}
                  defaultValue={headers.includes(f.name) ? f.name : ""}
                  required={f.required}
                >
                  <option value="">Do not map</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || !csv}>
          {busy ? "Validating…" : "Preview import"}
        </button>
      </form>
      {preview && (
        <div className="record-form">
          <h3>Preview: {preview.preview.length} rows</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Record</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((p) => (
                  <tr key={p.row}>
                    <td>{p.row}</td>
                    <td>
                      {String(
                        p.data.name ||
                          p.data.reference ||
                          p.data.description ||
                          p.data.email ||
                          "Record",
                      )}
                    </td>
                    <td>
                      {p.errors.length ? (
                        <span className="error-text">
                          {p.errors.join("; ")}
                        </span>
                      ) : (
                        <Status value="ready" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button primary"
            disabled={!preview.valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await requestJson<{ count: number }>(
                  "/api/imports",
                  "POST",
                  { action: "commit", id: preview.id },
                );
                setResult(
                  `${r.count} records imported. The complete batch was committed.`,
                );
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm import
          </button>
        </div>
      )}
      {result && (
        <p className="success-message" role="status">
          {result}
        </p>
      )}
    </Panel>
  );
}
