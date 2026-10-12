"use client";
import { ClientForm } from "./client-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { House, ArrowLeft, Plus, MapPin, Edit2 } from "lucide-react";
import { PageHeader, Panel } from "./ui";
import { RecordForm, Modal, DocumentUpload, type Options } from "./record-form";
import { str, type Row } from "./resource-table";
import { money } from "@/lib/calculations";
import { requestJson } from "@/lib/http";
export function PropertyDetail({
  property: p,
  options,
  editable,
  tenant,
  documentEditable,
  allowedModules,
}: {
  property: Row;
  options: Options;
  editable: boolean;
  tenant: boolean;
  documentEditable: boolean;
  allowedModules: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <Link className="back-link" href="/app/properties">
        <ArrowLeft size={15} />
        Back to properties
      </Link>
      <PageHeader
        eyebrow={str(p.type)}
        title={str(p.name)}
        description={`${str(p.address)}, ${str(p.postcode)}`}
        action={
          editable && (
            <button
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              <Edit2 size={16} />
              Edit property
            </button>
          )
        }
      />
      <div className="detail-layout">
        <div>
          <Panel title="Property overview">
            <div className="property-cover">
              <House size={100} strokeWidth={0.7} />
              <div>
                <span className="eyebrow">YOUR PROPERTY</span>
                <h2>{str(p.name)}</h2>
                <p>
                  <MapPin size={15} />
                  {str(p.postcode)}
                </p>
              </div>
            </div>
            <dl className="detail-grid padded">
              <div>
                <dt>Bedrooms</dt>
                <dd>{str(p.bedrooms)}</dd>
              </div>
              <div>
                <dt>Bathrooms</dt>
                <dd>{str(p.bathrooms)}</dd>
              </div>
              <div>
                <dt>Furnishing</dt>
                <dd>{str(p.furnishing)}</dd>
              </div>
              <div>
                <dt>EPC rating</dt>
                <dd>{str(p.epcRating)}</dd>
              </div>
              <div>
                <dt>Jurisdiction</dt>
                <dd>{str(p.jurisdiction)}</dd>
              </div>
              {!tenant && (
                <div>
                  <dt>Estimated value</dt>
                  <dd>
                    {p.valuePence
                      ? money(Number(p.valuePence))
                      : "Not recorded"}
                  </dd>
                </div>
              )}
            </dl>
            {!tenant && p.notes !== undefined && (
              <div className="record-form">
                <h3>Internal notes</h3>
                <p className="preserve-text">
                  {str(p.notes || "No notes recorded.")}
                </p>
              </div>
            )}
          </Panel>
          <Panel title="Rooms & units">
            <div className="record-form">
              {((p.units as Row[]) || []).map((u) => (
                <div className="unit-row" key={str(u.id)}>
                  <House size={18} />
                  <strong>{str(u.name)}</strong>
                  <span>{str(u.type)}</span>
                </div>
              ))}
              {editable && (
                <ClientForm
                  className="inline-form"
                  action={async (f) => {
                    try {
                      await requestJson("/api/workspace/units", "POST", {
                        propertyId: p.id,
                        name: f.get("name"),
                        type: f.get("type"),
                      });
                      router.refresh();
                      return true;
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <input
                    name="name"
                    placeholder="Room / unit name"
                    aria-label="Room or unit name"
                    required
                  />
                  <select name="type" aria-label="Unit type">
                    <option>room</option>
                    <option>flat</option>
                    <option>unit</option>
                  </select>
                  <button className="button secondary">
                    <Plus size={14} />
                    Add unit
                  </button>
                </ClientForm>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
            </div>
          </Panel>
          <Panel
            title="Property photographs & documents"
            action={
              documentEditable && (
                <DocumentUpload
                  options={options}
                  fixed={{ propertyId: str(p.id) }}
                />
              )
            }
          >
            <div className="attachment-list">
              {((p.documents as Row[]) || []).map((d) => (
                <a key={str(d.id)} href={`/api/documents/${d.id}`}>
                  <span>{str(d.name)}</span>
                  <span>{str(d.category)}</span>
                </a>
              ))}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Connected records">
            <div className="record-form related-links">
              {[
                "tenancies",
                "repairs",
                "compliance",
                "expenses",
                "documents",
                "tasks",
              ]
                .filter((s) => allowedModules.includes(s))
                .map((s) => (
                  <Link key={s} href={`/app/${s}?propertyId=${p.id}`}>
                    {s}
                    <span>↗</span>
                  </Link>
                ))}
            </div>
          </Panel>
          {!tenant && (
            <Panel title="Property management">
              <div className="record-form">
                <p className="muted">
                  Archive a property once its active tenancies have ended.
                  Historical records are retained.
                </p>
                {editable && (
                  <button
                    className="button danger"
                    onClick={async () => {
                      if (
                        confirm(
                          "Archive this property? Historical records will remain.",
                        )
                      )
                        try {
                          await requestJson(
                            `/api/workspace/properties/${p.id}`,
                            "PATCH",
                            { archive: true },
                          );
                          router.push("/app/properties");
                          router.refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                    }}
                  >
                    Archive property
                  </button>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
      {editing && (
        <Modal title="Edit property" onClose={() => setEditing(false)}>
          <RecordForm
            resource="properties"
            initial={p}
            editId={str(p.id)}
            options={options}
            onClose={() => setEditing(false)}
          />
        </Modal>
      )}
    </>
  );
}
