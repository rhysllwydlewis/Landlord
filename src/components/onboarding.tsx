"use client";
import { ClientForm } from "./client-form";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowRight,
  Check,
  House,
  Users,
  KeyRound,
  Mail,
} from "lucide-react";
import { brand } from "@/lib/config";
import { requestJson } from "@/lib/http";
export function Onboarding({
  step,
  organisation,
}: {
  step: number;
  organisation?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="onboarding-page">
      <Link className="brand" href="/">
        <Building2 size={26} />
        <span>{brand.name}</span>
      </Link>
      <div className="onboarding-card">
        <div className="eyebrow">LET’S GET YOU SET UP</div>
        <h1>
          {step ? "Make yourself at home." : "Your workspace starts here."}
        </h1>
        <p>
          {step
            ? `${organisation}: pick up where you left off.`
            : "Set up your organisation, then add your first property and tenancy."}
        </p>
        <div className="onboarding-progress">
          {["Organisation", "Property", "Tenancy", "Ready"].map((label, i) => (
            <div className={step > i ? "complete" : ""} key={label}>
              <span>{step > i ? <Check size={15} /> : i + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        {!step ? (
          <ClientForm
            action={async (f) => {
              setBusy(true);
              try {
                await requestJson("/api/organisation", "POST", {
                  name: f.get("name"),
                  type: f.get("type"),
                  jurisdiction: f.get("jurisdiction"),
                });
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="form-field">
              <span>Organisation / business name</span>
              <input
                name="name"
                required
                minLength={2}
                placeholder="Your name or company name"
              />
            </label>
            <div className="form-grid">
              <label className="form-field">
                <span>Business type</span>
                <select name="type">
                  <option>individual</option>
                  <option>limited company</option>
                </select>
              </label>
              <label className="form-field">
                <span>Default jurisdiction</span>
                <select name="jurisdiction">
                  {["England", "Wales", "Scotland", "Northern Ireland"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <p className="muted small">
              No payment card is required for development. Production trials and
              plans are set by the platform administrator.
            </p>
            <button className="button primary full" disabled={busy}>
              {busy ? "Creating…" : "Create organisation"}
              <ArrowRight size={16} />
            </button>
            {error && <p className="error-message">{error}</p>}
          </ClientForm>
        ) : (
          <div className="onboarding-steps">
            {[
              [
                "Add your first property",
                "Set the address, specifications and any rooms.",
                "/app/properties?new=1",
                House,
              ],
              [
                "Add your tenants",
                "Create tenant records before setting up the tenancy.",
                "/app/tenants?new=1",
                Users,
              ],
              [
                "Create a tenancy",
                "Connect people, property and the rent schedule.",
                "/app/tenancies?new=1",
                KeyRound,
              ],
              [
                "Invite your tenants",
                "Give each tenant secure access to their portal.",
                "/app/tenants",
                Mail,
              ],
            ].map(([title, description, href, Icon]) => (
              <Link key={String(href)} href={String(href)}>
                <Icon size={22} />
                <div>
                  <strong>{String(title)}</strong>
                  <p>{String(description)}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
            <Link className="button primary full" href="/app">
              Go to dashboard <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
