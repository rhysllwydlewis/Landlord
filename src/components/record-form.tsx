"use client";
import { ClientForm } from "./client-form";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, LoaderCircle, Paperclip, ShieldCheck } from "lucide-react";
import { modules, type Field } from "@/lib/modules";
import { requestJson } from "@/lib/http";
export type Options = {
  properties: {
    id: string;
    name: string;
    units: { id: string; name: string }[];
  }[];
  tenants: {
    id: string;
    name: string;
    email: string;
    userId: string | null;
    participants: { tenancyId: string }[];
  }[];
  tenancies: {
    id: string;
    reference: string;
    propertyId: string;
    unitId: string | null;
  }[];
  repairs?: { id: string; title: string; propertyId: string }[];
  documents?: { id: string; name: string; propertyId: string | null }[];
  compliance?: { id: string; title: string; propertyId: string }[];
};
const moneyField = (name: string, label: string, def = 0): Field => ({
  name,
  label,
  type: "money",
  required: true,
  default: def,
});
const operationFields: Record<string, Field[]> = {
  inventories: [
    {
      name: "type",
      label: "Report type",
      type: "select",
      options: ["check-in", "check-out", "inspection"],
    },
    { name: "date", label: "Inspection date", type: "date", required: true },
    { name: "meterReadings", label: "Meter readings", type: "textarea" },
    { name: "keys", label: "Keys issued / returned" },
    { name: "tenantComments", label: "Tenant comments", type: "textarea" },
  ],
  transitions: [
    {
      name: "type",
      label: "Workflow type",
      type: "select",
      options: ["move-in", "move-out"],
    },
    { name: "date", label: "Transition date", type: "date", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  improvements: [
    {
      name: "currentRating",
      label: "Current EPC rating",
      type: "select",
      options: ["A", "B", "C", "D", "E", "F", "G"],
    },
    {
      name: "targetRating",
      label: "Estimated target rating",
      type: "select",
      options: ["A", "B", "C", "D", "E", "F", "G"],
    },
    moneyField("estimatedCostPence", "Estimated cost"),
    {
      name: "work",
      label: "Proposed improvements",
      type: "textarea",
      required: true,
    },
    { name: "funding", label: "Grant / funding information", type: "textarea" },
    { name: "completed", label: "Work completed", type: "checkbox" },
  ],
  feedback: [
    {
      name: "type",
      label: "Request type",
      type: "select",
      options: ["general", "repair", "complaint", "assistance"],
    },
    {
      name: "repairId",
      label: "Repair (optional)",
      type: "select",
      source: "repairs",
    },
    { name: "rating", label: "Satisfaction rating (1–5)", type: "number" },
    {
      name: "body",
      label: "Your feedback / request",
      type: "textarea",
      required: true,
    },
  ],
  passport: [
    {
      name: "description",
      label: "Rental history / reference",
      type: "textarea",
      required: true,
    },
    {
      name: "shared",
      label: "Include this entry in my export",
      type: "checkbox",
    },
    {
      name: "consent",
      label: "I consent to sharing this entry when I export my passport",
      type: "checkbox",
    },
  ],
  bank: [
    { name: "date", label: "Transaction date", type: "date", required: true },
    moneyField("amountPence", "Amount (negative for outgoing)"),
    { name: "reference", label: "Statement reference", required: true },
    { name: "matchedPaymentId", label: "Matching payment record ID" },
    { name: "matchedExpenseId", label: "Matching expense record ID" },
  ],
  guarantors: [
    { name: "name", label: "Guarantor name", required: true },
    { name: "email", label: "Email address", type: "email", required: true },
    { name: "phone", label: "Phone number", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  forecasts: [
    moneyField("monthlyRentPence", "Monthly rental income"),
    moneyField("monthlyExpensePence", "Monthly operating expenses"),
    moneyField("maintenancePence", "Annual maintenance budget"),
    {
      name: "vacancyPercent",
      label: "Vacancy allowance (%)",
      type: "number",
      default: 5,
    },
    moneyField("valuePence", "Property value"),
    moneyField("investmentPence", "Cash invested"),
    {
      name: "growthPercent",
      label: "Annual rental growth assumption (%)",
      type: "number",
      default: 2,
    },
    { name: "years", label: "Years to model", type: "number", default: 5 },
  ],
};
export function FieldInput({
  field,
  options,
  propertyId,
  initial,
  tenant,
}: {
  field: Field;
  options: Options;
  propertyId?: string;
  initial?: unknown;
  tenant: boolean;
}) {
  const f = field;
  let choices: { id: string; label: string }[] = [];
  if (f.source === "properties")
    choices = options.properties.map((p) => ({ id: p.id, label: p.name }));
  if (f.source === "tenants")
    choices = options.tenants.map((p) => ({ id: p.id, label: p.name }));
  if (f.source === "tenancies")
    choices = options.tenancies.map((p) => ({ id: p.id, label: p.reference }));
  if (f.source === "units")
    choices = options.properties
      .filter((p) => !propertyId || p.id === propertyId)
      .flatMap((p) =>
        p.units.map((u) => ({ id: u.id, label: `${p.name} — ${u.name}` })),
      );
  if (f.source === "repairs")
    choices = (options.repairs || [])
      .filter((r) => !propertyId || r.propertyId === propertyId)
      .map((r) => ({ id: r.id, label: r.title }));
  if (f.source === "documents")
    choices = (options.documents || [])
      .filter((d) => !propertyId || d.propertyId === propertyId)
      .map((d) => ({ id: d.id, label: d.name }));
  if (f.source === "compliance")
    choices = (options.compliance || [])
      .filter((c) => !propertyId || c.propertyId === propertyId)
      .map((c) => ({ id: c.id, label: c.title }));
  if (f.options) choices = f.options.map((s) => ({ id: s, label: s }));
  const value = initial ?? f.default;
  if (tenant && f.name === "tenantIds") return null;
  if (f.type === "multi")
    return (
      <fieldset className="form-field wide">
        <legend>{f.label}</legend>
        <div className="multi-options">
          {choices.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                name={f.name}
                value={c.id}
                defaultChecked={Array.isArray(value) && value.includes(c.id)}
              />
              {c.label}
            </label>
          ))}
          {!choices.length && <p>No available records. Add these first.</p>}
        </div>
      </fieldset>
    );
  if (f.type === "checkbox")
    return (
      <label className="checkbox-field">
        <input type="checkbox" name={f.name} defaultChecked={Boolean(value)} />
        <span>{f.label}</span>
      </label>
    );
  return (
    <label className={`form-field ${f.type === "textarea" ? "wide" : ""}`}>
      <span>
        {f.label}
        {f.required && <b aria-hidden="true"> *</b>}
      </span>
      {f.type === "textarea" ? (
        <textarea
          aria-label={f.label}
          name={f.name}
          rows={3}
          required={f.required}
          defaultValue={String(value ?? "")}
        />
      ) : f.type === "select" ? (
        <select
          aria-label={f.label}
          name={f.name}
          required={f.required}
          defaultValue={String(
            value ??
              (f.required || (f.options && f.name !== "epcRating")
                ? choices[0]?.id || ""
                : ""),
          )}
        >
          {((!f.required && !f.options) || f.name === "epcRating") && (
            <option value="">None / not recorded</option>
          )}
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <div className={f.type === "money" ? "money-input" : ""}>
          {f.type === "money" && <span>£</span>}
          <input
            aria-label={f.label}
            name={f.name}
            type={
              f.type === "money" || f.type === "number"
                ? "number"
                : f.type === "date"
                  ? "date"
                  : f.type === "email"
                    ? "email"
                    : "text"
            }
            step={
              f.type === "money" || f.type === "number" ? "0.01" : undefined
            }
            required={f.required}
            defaultValue={
              value === undefined
                ? ""
                : f.type === "money"
                  ? Number(value) / 100
                  : String(value)
            }
            maxLength={f.type === "text" || !f.type ? 250 : undefined}
          />
        </div>
      )}
      {f.hint && <small>{f.hint}</small>}
    </label>
  );
}
export function RecordForm({
  resource,
  options,
  tenant = false,
  onClose,
  onSuccess,
  initial,
  editId,
  fixed,
}: {
  resource: string;
  options: Options;
  tenant?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  initial?: Record<string, unknown>;
  editId?: string;
  fixed?: Record<string, unknown>;
}) {
  const router = useRouter();
  const definition = modules[resource];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const submissionKey = useRef<string | null>(null);
  const [propertyId, setPropertyId] = useState(
    String(
      initial?.propertyId ||
        fixed?.propertyId ||
        options.properties[0]?.id ||
        "",
    ),
  );
  const data = (initial?.data || {}) as Record<string, unknown>;
  const [items, setItems] = useState(
    (data.items as
      | {
          room: string;
          item: string;
          condition: string;
          notes: string;
          documentIds: string[];
        }[]
      | undefined) || [
      { room: "", item: "", condition: "good", notes: "", documentIds: [] },
    ],
  );
  const [checks, setChecks] = useState(
    (data.checklist as { label: string; completed: boolean }[] | undefined) ||
      [
        "Agreement / notice recorded",
        "Rent and deposit reviewed",
        "Inventory completed",
        "Meter readings recorded",
        "Keys handed over / returned",
        "Documents provided",
      ].map((label) => ({ label, completed: false })),
  );
  const fields = definition.fields.filter((f) => !(fixed && f.name in fixed));
  function parseFields(fs: Field[], form: FormData) {
    const out: Record<string, unknown> = {};
    for (const f of fs) {
      if (tenant && f.name === "tenantIds") {
        out[f.name] = [];
        continue;
      }
      const raw = form.get(f.name);
      if (f.type === "multi") out[f.name] = form.getAll(f.name).map(String);
      else if (f.type === "checkbox") out[f.name] = raw === "on";
      else if (raw !== null && raw !== "")
        out[f.name] =
          f.type === "money"
            ? Math.round(Number(raw) * 100)
            : f.type === "number"
              ? Number(raw)
              : String(raw);
    }
    return out;
  }
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      let payload: Record<string, unknown> = {
        ...parseFields(fields, form),
        ...fixed,
      };
      if (["payments", "rent"].includes(resource)) {
        submissionKey.current ??= crypto.randomUUID();
        payload.idempotencyKey = submissionKey.current;
      }
      if (operationFields[resource]) {
        const extra = parseFields(operationFields[resource], form);
        if (resource === "inventories") {
          extra.items = items;
          extra.acknowledged = editId ? !!data.acknowledged : false;
        }
        if (resource === "transitions") extra.checklist = checks;
        if (resource === "passport") {
          extra.source = "self-reported";
        }
        if (resource === "feedback") {
          extra.response = String(data.response || "");
        }
        payload = editId
          ? { data: { ...data, ...extra } }
          : { ...payload, data: extra };
      }
      const result = savedId
        ? { id: savedId }
        : await requestJson<{ id: string }>(
            `/api/workspace/${resource}${editId ? `/${editId}` : ""}`,
            editId ? "PATCH" : "POST",
            payload,
          );
      if (!editId) setSavedId(result.id);
      const files = form
        .getAll("attachments")
        .filter((f): f is File => f instanceof File && f.size > 0);
      for (const file of files) {
        const upload = new FormData();
        upload.set("file", file);
        upload.set(
          "category",
          resource === "repairs" ? "Repair evidence" : "Property photograph",
        );
        if (resource === "repairs") upload.set("repairId", result.id);
        else upload.set("propertyId", result.id);
        try {
          await requestJson("/api/documents", "POST", upload);
        } catch (e) {
          throw new Error(
            `The ${definition.singular} was saved, but an attachment failed: ${(e as Error).message}. Open the saved record to retry the upload.`,
          );
        }
      }
      onSuccess?.();
      router.refresh();
      if (resource === "repairs" && !editId)
        router.push(`/app/repairs/${result.id}`);
      else if (resource === "properties" && !editId)
        router.push(`/app/properties/${result.id}`);
      onClose?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ClientForm
      action={submit}
      className="record-form"
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (target.name === "propertyId") setPropertyId(target.value);
      }}
    >
      {resource === "repairs" && (
        <div className="form-notice">
          <ShieldCheck size={17} />
          <span>
            {tenant
              ? "Your report and updates are visible to you and your landlord. Other tenants do not automatically receive access."
              : "New landlord repairs are private. Choose tenant access after saving."}
          </span>
        </div>
      )}
      {resource === "repairs" && (
        <div className="safety-note">
          For immediate danger, call 999. Suspected gas leak: call the relevant
          gas emergency service. Use your property’s emergency contact for
          urgent repairs. This portal is not continuously monitored.
        </div>
      )}
      <div className="form-grid">
        {fields.map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            options={options}
            propertyId={propertyId}
            initial={initial?.[f.name]}
            tenant={tenant}
          />
        ))}
        {operationFields[resource]?.map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            options={options}
            initial={data[f.name]}
            tenant={tenant}
          />
        ))}
      </div>
      {resource === "inventories" && (
        <div className="repeater">
          <h3>Rooms, items & condition</h3>
          {items.map((item, i) => (
            <div key={i} className="inventory-input">
              <input
                aria-label={`Room ${i + 1}`}
                placeholder="Room"
                required
                value={item.room}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, room: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label={`Item ${i + 1}`}
                placeholder="Item / appliance"
                required
                value={item.item}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, item: e.target.value } : x,
                    ),
                  )
                }
              />
              <select
                aria-label={`Condition ${i + 1}`}
                value={item.condition}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, condition: e.target.value } : x,
                    ),
                  )
                }
              >
                {["new", "good", "fair", "poor", "damaged"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                aria-label={`Notes ${i + 1}`}
                placeholder="Condition notes"
                value={item.notes}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, notes: e.target.value } : x,
                    ),
                  )
                }
              />
              <label className="inventory-evidence">
                Evidence documents
                <select
                  multiple
                  aria-label={`Evidence for item ${i + 1}`}
                  value={item.documentIds}
                  onChange={(e) =>
                    setItems(
                      items.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              documentIds: [...e.target.selectedOptions].map(
                                (o) => o.value,
                              ),
                            }
                          : x,
                      ),
                    )
                  }
                >
                  {(options.documents || [])
                    .filter((d) => !propertyId || d.propertyId === propertyId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove item"
                onClick={() => setItems(items.filter((_, n) => n !== i))}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setItems([
                ...items,
                {
                  room: "",
                  item: "",
                  condition: "good",
                  notes: "",
                  documentIds: [],
                },
              ])
            }
          >
            <Plus size={14} />
            Add item
          </button>
        </div>
      )}
      {resource === "transitions" && (
        <div className="repeater">
          <h3>Your checklist</h3>
          {checks.map((c, i) => (
            <div className="checklist-input" key={i}>
              <input
                type="checkbox"
                aria-label={`Complete ${c.label}`}
                checked={c.completed}
                onChange={(e) =>
                  setChecks(
                    checks.map((x, n) =>
                      n === i ? { ...x, completed: e.target.checked } : x,
                    ),
                  )
                }
              />
              <input
                aria-label={`Checklist item ${i + 1}`}
                value={c.label}
                onChange={(e) =>
                  setChecks(
                    checks.map((x, n) =>
                      n === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove checklist item"
                onClick={() => setChecks(checks.filter((_, n) => n !== i))}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setChecks([...checks, { label: "New step", completed: false }])
            }
          >
            <Plus size={14} />
            Add step
          </button>
        </div>
      )}
      {["properties", "repairs"].includes(resource) && !editId && (
        <label className="upload-zone">
          <Paperclip size={21} />
          <strong>Photographs & supporting files</strong>
          <span>PDF, JPEG, PNG or WebP · up to 10 MB per file</span>
          <input
            name="attachments"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
          />
        </label>
      )}
      {resource === "forecasts" && (
        <div className="form-notice">
          Estimates use your assumptions. Operating costs exclude tax and
          capital gains. Results are not guaranteed.
        </div>
      )}
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      <div className="form-footer">
        {onClose && (
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Plus size={16} />
          )}{" "}
          {editId
            ? "Save changes"
            : tenant && resource === "repairs"
              ? "Submit repair"
              : `Save ${definition.singular}`}
        </button>
      </div>
    </ClientForm>
  );
}
export function NewRecord({
  resource,
  options,
  tenant = false,
  startOpen = false,
  fixed,
}: {
  resource: string;
  options: Options;
  tenant?: boolean;
  startOpen?: boolean;
  fixed?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        {tenant && resource === "repairs"
          ? "Report a repair"
          : `Add ${modules[resource].singular}`}
      </button>
      {open && (
        <Modal
          title={
            tenant && resource === "repairs"
              ? "Report a repair"
              : `Add ${modules[resource].singular}`
          }
          onClose={() => setOpen(false)}
        >
          <RecordForm
            resource={resource}
            options={options}
            tenant={tenant}
            fixed={fixed}
            onClose={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const elements = e.currentTarget.querySelectorAll<HTMLElement>(
              "button,input,textarea,select,a[href]",
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            autoFocus
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function DocumentUpload({
  options,
  startOpen = false,
  fixed,
  tenant = false,
}: {
  options: Options;
  startOpen?: boolean;
  fixed?: { repairId?: string; propertyId?: string };
  tenant?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Upload document
      </button>
      {open && (
        <Modal title="Upload document" onClose={() => setOpen(false)}>
          <ClientForm
            className="record-form"
            action={async (f) => {
              setBusy(true);
              setError("");
              try {
                for (const [key, value] of Object.entries(fixed || {}))
                  if (value) f.set(key, value);
                f.set("tenantIds", JSON.stringify(f.getAll("recipients")));
                await requestJson("/api/documents", "POST", f);
                setOpen(false);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              {!fixed?.propertyId && !fixed?.repairId && !tenant && (
                <FieldInput
                  field={{
                    name: "propertyId",
                    label: "Property",
                    type: "select",
                    source: "properties",
                  }}
                  options={options}
                  tenant={tenant}
                />
              )}
              <FieldInput
                field={{
                  name: "tenancyId",
                  label: "Tenancy",
                  type: "select",
                  source: "tenancies",
                  required: tenant && !fixed?.repairId,
                }}
                options={options}
                tenant={tenant}
              />
              <label className="form-field">
                <span>Category</span>
                <select name="category">
                  {[
                    "General",
                    "Agreement",
                    "Certificate",
                    "Property photograph",
                    "Inventory evidence",
                    "Receipt",
                    "Repair evidence",
                    "Deposit evidence",
                    "Floor plan",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="upload-zone">
              <Paperclip />
              <strong>Choose a private file</strong>
              <span>PDF, JPEG, PNG or WebP · 10 MB maximum</span>
              <input
                type="file"
                name="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp"
              />
            </label>
            {!tenant && (
              <label className="checkbox-field">
                <input name="ownerVisible" type="checkbox" />
                Make available to authorised read-only property owners
              </label>
            )}
            {!tenant && (
              <div className="form-field">
                <span>Share with selected tenants (optional)</span>
                <div className="multi-options">
                  {options.tenants.map((t) => (
                    <label key={t.id}>
                      <input name="recipients" type="checkbox" value={t.id} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <p className="muted small">
              Files stay private unless shared. Repair files also require access
              to the repair.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="form-footer">
              <button className="button primary" disabled={busy}>
                {busy ? "Uploading…" : "Upload securely"}
              </button>
            </div>
          </ClientForm>
        </Modal>
      )}
    </>
  );
}
