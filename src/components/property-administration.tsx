"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientForm } from "./client-form";
import { FieldInput, Modal, type Options } from "./record-form";
import { Panel } from "./ui";
import { obj, str, type Row } from "@/lib/records";
import { date, money } from "@/lib/calculations";
import { requestJson } from "@/lib/http";
import type { Field } from "@/lib/modules";

const generalFields: Field[] = [
  { name: "localAuthority", label: "Local authority" },
  { name: "licenceType", label: "Licence type" },
  { name: "licenceReference", label: "Licence reference" },
  { name: "licenceExpiresAt", label: "Licence expiry", type: "date" },
];
const financialFields: Field[] = [
  { name: "purchaseDate", label: "Purchase date", type: "date" },
  { name: "mortgageProvider", label: "Mortgage provider" },
  { name: "mortgageReference", label: "Mortgage reference" },
  { name: "mortgageBalancePence", label: "Mortgage balance", type: "money" },
  { name: "mortgagePaymentPence", label: "Mortgage payment", type: "money" },
  { name: "insuranceProvider", label: "Insurance provider" },
  { name: "insuranceReference", label: "Insurance policy reference" },
  { name: "insuranceExpiresAt", label: "Insurance renewal", type: "date" },
];
function Details({ fields, values }: { fields: Field[]; values: Row }) {
  return (
    <dl className="detail-grid padded">
      {fields.map((f) => (
        <div key={f.name}>
          <dt>{f.label}</dt>
          <dd>
            {values[f.name] == null || values[f.name] === ""
              ? "Not recorded"
              : f.type === "money"
                ? money(Number(values[f.name]))
                : f.type === "date"
                  ? date(str(values[f.name]))
                  : str(values[f.name])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function PropertyAdministration({
  property: p,
  options,
  editable,
}: {
  property: Row;
  options: Options;
  editable: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const details = obj(p.details);
  const fields = [
    ...generalFields,
    ...(options.financeWrite ? financialFields : []),
  ];
  return (
    <>
      <Panel
        title="Ownership, licensing & property records"
        subtitle="Recorded information; licence requirements should be verified for this property."
      >
        {editable ? (
          <ClientForm
            className="record-form"
            action={async (f) => {
              setSaved(false);
              const updated: Record<string, unknown> = {};
              for (const field of fields) {
                const value = String(f.get(field.name) || "");
                updated[field.name] =
                  field.type === "money"
                    ? value
                      ? Math.round(Number(value) * 100)
                      : null
                    : field.type === "date"
                      ? value || null
                      : value;
              }
              await requestJson(`/api/properties/${p.id}/details`, "PATCH", {
                portfolioId: f.get("portfolioId") || null,
                ownerId: f.get("ownerId") || null,
                details: updated,
              });
              setSaved(true);
              router.refresh();
            }}
          >
            <div className="form-grid">
              <label className="form-field">
                <span>Portfolio</span>
                <select
                  name="portfolioId"
                  defaultValue={String(p.portfolioId || "")}
                >
                  <option value="">None / not recorded</option>
                  {options.portfolios?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Owning entity</span>
                <select name="ownerId" defaultValue={String(p.ownerId || "")}>
                  <option value="">None / not recorded</option>
                  {options.owners?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              {fields.map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  options={options}
                  tenant={false}
                  initial={details[f.name] ?? ""}
                />
              ))}
            </div>
            <p className="muted small">
              Mortgage payments are recorded amounts. They do not create
              accounting transactions automatically.
            </p>
            <button className="button primary">Save property records</button>
            {saved && (
              <p className="success-message" role="status">
                Property records saved.
              </p>
            )}
          </ClientForm>
        ) : (
          <>
            <dl className="detail-grid padded">
              <div>
                <dt>Portfolio</dt>
                <dd>{str(obj(p.portfolio).name || "Not recorded")}</dd>
              </div>
              <div>
                <dt>Owning entity</dt>
                <dd>{str(obj(p.owner).name || "Not recorded")}</dd>
              </div>
            </dl>
            <Details fields={generalFields} values={details} />
          </>
        )}
        {options.financeRead && (!editable || !options.financeWrite) && (
          <Details fields={financialFields} values={details} />
        )}
      </Panel>
      <Panel title="Property activity">
        <div className="record-form timeline">
          {((p.history as Row[]) || []).map((event) => (
            <div key={str(event.id)}>
              <span className="timeline-dot" />
              <strong>{str(event.action).replaceAll(".", " ")}</strong>
              <small>{date(str(event.createdAt))}</small>
            </div>
          ))}
          {!((p.history as Row[]) || []).length && (
            <p className="muted">No recorded activity yet.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
export function UnitActions({ unit: u }: { unit: Row }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <div className="section-links">
        {u.archivedAt ? (
          <span className="muted small">Archived</span>
        ) : (
          <button
            className="button secondary"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${u.name}`}
          >
            Edit
          </button>
        )}
        <button
          className={`button ${u.archivedAt ? "secondary" : "danger"}`}
          aria-label={`${u.archivedAt ? "Restore" : "Archive"} ${u.name}`}
          onClick={async () => {
            if (
              !u.archivedAt &&
              !confirm(
                "Archive this room? Active tenancies must end first. Historical records will remain.",
              )
            )
              return;
            setError("");
            try {
              await requestJson(`/api/workspace/units/${u.id}`, "PATCH", {
                archive: !u.archivedAt,
              });
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {u.archivedAt ? "Restore" : "Archive"}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <Modal title="Edit room or unit" onClose={() => setEditing(false)}>
          <ClientForm
            className="record-form"
            action={async (f) => {
              await requestJson(`/api/workspace/units/${u.id}`, "PATCH", {
                name: f.get("name"),
                type: f.get("type"),
              });
              setEditing(false);
              router.refresh();
            }}
          >
            <label className="form-field">
              <span>Unit name</span>
              <input
                name="name"
                defaultValue={str(u.name)}
                minLength={1}
                maxLength={100}
                required
              />
            </label>
            <label className="form-field">
              <span>Unit type</span>
              <select name="type" defaultValue={str(u.type)}>
                <option>room</option>
                <option>flat</option>
                <option>unit</option>
              </select>
            </label>
            <button className="button primary">Save unit</button>
          </ClientForm>
        </Modal>
      )}
    </div>
  );
}
