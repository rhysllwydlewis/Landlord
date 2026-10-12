"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "./ui";
import { TwoFactorSetup } from "./two-factor";
import { requestJson } from "@/lib/http";
import { authClient } from "@/lib/auth-client";
import { permissions } from "@/lib/config";
import type { Options } from "./record-form";
import type { Row } from "./resource-table";
export function SettingsForm({
  name,
  organisationName,
  owner,
}: {
  name: string;
  organisationName: string;
  owner: boolean;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <Panel title="Profile & organisation">
        <form
          className="record-form"
          action={async (f) => {
            try {
              await requestJson("/api/settings", "PATCH", {
                name: f.get("name"),
                ...(owner
                  ? { organisationName: f.get("organisationName") }
                  : {}),
              });
              setMessage("Settings saved.");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Your name</span>
              <input name="name" defaultValue={name} required minLength={2} />
            </label>
            {owner && (
              <label className="form-field">
                <span>Organisation name</span>
                <input
                  name="organisationName"
                  defaultValue={organisationName}
                  required
                  minLength={2}
                />
              </label>
            )}
          </div>
          <p className="muted">
            Default currency: GBP · Time zone: UTC · Dates: en-GB · Repair
            visibility: private
          </p>
          <button className="button primary">Save settings</button>
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
        </form>
      </Panel>
      <Panel title="Account security">
        <form
          className="record-form"
          action={async (f) => {
            const r = await authClient.changePassword({
              currentPassword: String(f.get("current")),
              newPassword: String(f.get("new")),
              revokeOtherSessions: true,
            });
            if (r.error)
              setError(r.error.message || "Unable to update password.");
            else
              setMessage("Password updated. Other sessions have been revoked.");
          }}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Current password</span>
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="form-field">
              <span>New password (at least 12 characters)</span>
              <input
                name="new"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
          </div>
          <button className="button secondary">Change password</button>
        </form>
      </Panel>
      <TwoFactorSetup />
      <Panel title="Notification preferences">
        <form
          className="record-form"
          action={async (f) => {
            try {
              await requestJson("/api/settings", "PATCH", {
                notificationPreferences: { email: f.get("email") === "on" },
              });
              setMessage("Preferences saved.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label className="checkbox-field">
            <input name="email" type="checkbox" defaultChecked />
            Email me about routine portal updates
          </label>
          <p className="muted small">
            Account verification, security and invitations remain essential
            transactional messages.
          </p>
          <button className="button secondary">Save preferences</button>
        </form>
      </Panel>
      <Panel title="Privacy & data requests">
        <div className="record-form">
          <p>
            You can request account deletion for administrator review. Financial
            and evidence retention requirements are reviewed before records are
            removed.
          </p>
          <button
            className="button danger"
            onClick={async () => {
              if (confirm("Request a review of account deletion?")) {
                await requestJson("/api/settings", "PATCH", {
                  deletionRequest: true,
                });
                setMessage("Deletion request recorded for review.");
              }
            }}
          >
            Request account deletion review
          </button>
          <Link className="text-link" href="/app/imports">
            Organisation data exports
          </Link>
        </div>
      </Panel>
    </>
  );
}
export function TeamTools({
  options,
  members,
}: {
  options: Options;
  members: Row[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [kind, setKind] = useState("STAFF");
  const router = useRouter();
  return (
    <>
      <Panel
        title="Invite staff or property owners"
        subtitle="Staff receive granular permissions. Owner access is limited to selected properties."
      >
        <form
          className="record-form"
          action={async (f) => {
            try {
              await requestJson("/api/invitations", "POST", {
                email: f.get("email"),
                role: f.get("role"),
                permissions: f.getAll("permissions"),
                propertyIds: f.getAll("properties"),
              });
              setSuccess("Invitation queued.");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Email address</span>
              <input type="email" name="email" required />
            </label>
            <label className="form-field">
              <span>Access type</span>
              <select
                name="role"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="STAFF">Staff / property manager</option>
                <option value="STAKEHOLDER">Read-only property owner</option>
              </select>
            </label>
          </div>
          <h3>Permissions</h3>
          <div className="permissions-grid">
            {(kind === "STAFF" ? permissions : ["finance", "documents"]).map(
              (p) => (
                <div key={p}>
                  <strong>{p}</strong>
                  <label>
                    <input
                      type="checkbox"
                      name="permissions"
                      value={`${p}:read`}
                    />
                    Read
                  </label>
                  {kind === "STAFF" && (
                    <label>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={`${p}:write`}
                      />
                      Write
                    </label>
                  )}
                </div>
              ),
            )}
          </div>
          <h3>Property access</h3>
          <p className="muted small">
            For staff, no selection grants access across the organisation for
            the chosen permissions. For read-only owners, no selection grants no
            property access.
          </p>
          <div className="multi-options">
            {options.properties.map((p) => (
              <label key={p.id}>
                <input type="checkbox" name="properties" value={p.id} />
                {p.name}
              </label>
            ))}
          </div>
          <button className="button primary">Send invitation</button>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="success-message" role="status">
              {success}
            </p>
          )}
        </form>
      </Panel>
      <Panel title="Current team">
        <div className="record-form">
          {members.map((m) => (
            <div key={String(m.id)} className="team-row">
              <span>
                <strong>{String((m.user as Row).name)}</strong>
                <small>{String((m.user as Row).email)}</small>
              </span>
              <span>{String(m.role)}</span>
              {["STAFF", "STAKEHOLDER"].includes(String(m.role)) && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    if (
                      confirm(
                        `${m.active ? "Deactivate" : "Reactivate"} this membership?`,
                      )
                    ) {
                      await requestJson("/api/team", "PATCH", {
                        membershipId: m.id,
                        active: !m.active,
                        permissions: m.permissions,
                        propertyIds: m.propertyIds,
                      });
                      router.refresh();
                    }
                  }}
                >
                  {m.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          ))}
          {members
            .filter((m) => ["STAFF", "STAKEHOLDER"].includes(String(m.role)))
            .map((m) => (
              <details className="team-access-editor" key={String(m.id)}>
                <summary>
                  Edit access for {String((m.user as Row).name)}
                </summary>
                <form
                  action={async (f) => {
                    try {
                      await requestJson("/api/team", "PATCH", {
                        membershipId: m.id,
                        active: f.get("active") === "on",
                        permissions: f.getAll("permissions"),
                        propertyIds: f.getAll("propertyIds"),
                      });
                      setSuccess("Access updated.");
                      router.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <div className="permissions-grid">
                    {(m.role === "STAFF"
                      ? permissions
                      : ["finance", "documents"]
                    ).map((p) => (
                      <div key={p}>
                        <strong>{p}</strong>
                        <label>
                          <input
                            type="checkbox"
                            name="permissions"
                            value={`${p}:read`}
                            defaultChecked={(
                              m.permissions as string[]
                            ).includes(`${p}:read`)}
                          />
                          Read
                        </label>
                        {m.role === "STAFF" && (
                          <label>
                            <input
                              type="checkbox"
                              name="permissions"
                              value={`${p}:write`}
                              defaultChecked={(
                                m.permissions as string[]
                              ).includes(`${p}:write`)}
                            />
                            Write
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="multi-options">
                    {options.properties.map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          name="propertyIds"
                          value={p.id}
                          defaultChecked={(m.propertyIds as string[]).includes(
                            p.id,
                          )}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={!!m.active}
                    />
                    Active membership
                  </label>
                  <button className="button secondary">Save access</button>
                </form>
              </details>
            ))}
        </div>
      </Panel>
    </>
  );
}
export function BillingButtons({
  enabled,
  customer,
  plans,
}: {
  enabled: boolean;
  customer: boolean;
  plans: { id: string; name: string; monthlyPence: number }[];
}) {
  const [error, setError] = useState("");
  return (
    <div className="record-form">
      {enabled ? (
        <>
          {customer && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const r = await requestJson<{ url: string }>(
                    "/api/billing",
                    "POST",
                    { action: "portal" },
                  );
                  location.assign(r.url);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Open Stripe customer portal
            </button>
          )}
          <form
            className="inline-form"
            action={async (f) => {
              try {
                const r = await requestJson<{ url: string }>(
                  "/api/billing",
                  "POST",
                  {
                    action: "checkout",
                    planId: f.get("planId"),
                    interval: f.get("interval"),
                  },
                );
                location.assign(r.url);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <select name="planId" aria-label="Subscription plan">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select name="interval" aria-label="Billing interval">
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
            <button className="button primary" disabled={!plans.length}>
              Continue to Stripe
            </button>
          </form>
        </>
      ) : (
        <p className="form-notice">
          Stripe Billing is unconfigured. Development plans do not charge real
          money and cannot be used in production.
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
export function MarkNotifications() {
  const router = useRouter();
  return (
    <button
      className="button secondary"
      onClick={async () => {
        await requestJson("/api/notifications", "PATCH", {});
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
