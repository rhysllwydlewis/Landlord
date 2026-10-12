"use client";
import { ClientForm } from "./client-form";
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
import type {
  WorkspaceSettings,
  ProfilePreferences,
} from "@/lib/workspace-settings";
export function SettingsForm({
  name,
  organisationName,
  owner,
  emailUpdates,
  profile,
  workspaceSettings,
  twoFactorEnabled,
}: {
  name: string;
  organisationName: string;
  owner: boolean;
  emailUpdates: boolean;
  profile: ProfilePreferences;
  workspaceSettings: WorkspaceSettings;
  twoFactorEnabled: boolean;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [operationsMessage, setOperationsMessage] = useState("");
  const router = useRouter();
  return (
    <>
      <Panel title="Profile & organisation">
        <ClientForm
          className="record-form"
          action={async (f) => {
            setMessage("");
            setError("");
            try {
              await requestJson("/api/settings", "PATCH", {
                name: f.get("name"),
                profile: {
                  phone: f.get("phone"),
                  preferredContact: f.get("preferredContact"),
                  accessibilityNeeds: f.get("accessibilityNeeds"),
                },
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
            <label className="form-field">
              <span>Telephone</span>
              <input
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={profile.phone}
              />
            </label>
            <label className="form-field">
              <span>Preferred contact method</span>
              <select
                name="preferredContact"
                defaultValue={profile.preferredContact}
              >
                <option value="portal">Portal</option>
                <option value="email">Email</option>
                <option value="phone">Telephone</option>
              </select>
            </label>
            <label className="form-field wide">
              <span>Accessibility or communication needs</span>
              <textarea
                name="accessibilityNeeds"
                maxLength={1000}
                rows={3}
                defaultValue={profile.accessibilityNeeds}
              />
              <small>
                Optional. Keep your preferred format or communication needs on
                record. Share relevant requirements with your landlord through a
                private message.
              </small>
            </label>
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
        </ClientForm>
      </Panel>
      <Panel title="Account security">
        <ClientForm
          className="record-form"
          action={async (f) => {
            setSecurityMessage("");
            setSecurityError("");
            const r = await authClient.changePassword({
              currentPassword: String(f.get("current")),
              newPassword: String(f.get("new")),
              revokeOtherSessions: true,
            });
            if (r.error)
              setSecurityError(r.error.message || "Unable to update password.");
            else
              setSecurityMessage(
                "Password updated. Other sessions have been revoked.",
              );
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
          {securityMessage && (
            <p className="success-message" role="status">
              {securityMessage}
            </p>
          )}
          {securityError && (
            <p className="error-message" role="alert">
              {securityError}
            </p>
          )}
        </ClientForm>
      </Panel>
      {twoFactorEnabled ? (
        <Panel title="Two-factor authentication">
          <p className="record-form" role="status">
            Two-factor authentication is enabled for your account.
          </p>
        </Panel>
      ) : (
        <TwoFactorSetup />
      )}
      {owner && (
        <Panel
          title="Repair safety & reminders"
          subtitle="Emergency guidance is visible to tenants. The portal is not continuously monitored."
        >
          <ClientForm
            className="record-form"
            action={async (f) => {
              setOperationsMessage("");
              await requestJson("/api/settings", "PATCH", {
                organisationSettings: {
                  emergencyContact: f.get("emergencyContact"),
                  emergencyGuidance: f.get("emergencyGuidance"),
                  complianceReminderDays: Number(
                    f.get("complianceReminderDays"),
                  ),
                  documentReminderDays: Number(f.get("documentReminderDays")),
                },
              });
              setOperationsMessage("Repair safety and reminders saved.");
              router.refresh();
            }}
          >
            <label className="form-field">
              <span>Landlord emergency contact</span>
              <input
                name="emergencyContact"
                maxLength={200}
                defaultValue={workspaceSettings.emergencyContact}
              />
            </label>
            <label className="form-field">
              <span>Property repair safety guidance</span>
              <textarea
                name="emergencyGuidance"
                rows={4}
                maxLength={3000}
                defaultValue={workspaceSettings.emergencyGuidance}
              />
            </label>
            <div className="form-grid">
              <label className="form-field">
                <span>Compliance reminder lead time (days)</span>
                <input
                  name="complianceReminderDays"
                  type="number"
                  min={1}
                  max={180}
                  required
                  defaultValue={workspaceSettings.complianceReminderDays}
                />
              </label>
              <label className="form-field">
                <span>Document reminder lead time (days)</span>
                <input
                  name="documentReminderDays"
                  type="number"
                  min={1}
                  max={180}
                  required
                  defaultValue={workspaceSettings.documentReminderDays}
                />
              </label>
            </div>
            <p className="muted small">
              Reminder lead times are administrative preferences, not statutory
              deadlines.
            </p>
            <button className="button primary">
              Save repair safety & reminders
            </button>
            {operationsMessage && (
              <p className="success-message" role="status">
                {operationsMessage}
              </p>
            )}
          </ClientForm>
        </Panel>
      )}
      <Panel title="Notification preferences">
        <ClientForm
          className="record-form"
          action={async (f) => {
            try {
              await requestJson("/api/settings", "PATCH", {
                notificationPreferences: { email: f.get("email") === "on" },
              });
              setPreferenceMessage("Preferences saved.");
              setPreferenceError("");
              router.refresh();
            } catch (e) {
              setPreferenceError((e as Error).message);
            }
          }}
        >
          <label className="checkbox-field">
            <input name="email" type="checkbox" defaultChecked={emailUpdates} />
            Email me about routine portal updates
          </label>
          <p className="muted small">
            Account verification, security and invitations remain essential
            transactional messages.
          </p>
          <button className="button secondary">Save preferences</button>
          {preferenceMessage && (
            <p className="success-message" role="status">
              {preferenceMessage}
            </p>
          )}
          {preferenceError && (
            <p className="error-message" role="alert">
              {preferenceError}
            </p>
          )}
        </ClientForm>
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
        <ClientForm
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
        </ClientForm>
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
                <ClientForm
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
                </ClientForm>
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
          <ClientForm
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
          </ClientForm>
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
