"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Panel } from "./ui";
export function TwoFactorSetup() {
  const [setup, setSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [message, setMessage] = useState("");
  return (
    <Panel
      title="Two-factor authentication"
      subtitle="Required for platform administrators in production."
    >
      <form
        className="record-form"
        action={async (f) => {
          const r = await authClient.twoFactor.enable({
            password: String(f.get("password")),
          });
          if (r.error)
            setMessage(
              r.error.message || "Unable to enable two-factor authentication.",
            );
          else if (r.data && "totpURI" in r.data) setSetup(r.data);
        }}
      >
        <label className="form-field">
          <span>Current password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button secondary">Set up authenticator</button>
      </form>
      {setup && (
        <div className="record-form">
          <p>
            Add this private TOTP setup URI to your authenticator app. Keep your
            backup codes somewhere secure.
          </p>
          <code className="private-code">{setup.totpURI}</code>
          <div className="backup-codes">
            {setup.backupCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <form
            action={async (f) => {
              const r = await authClient.twoFactor.verifyTotp({
                code: String(f.get("code")),
              });
              setMessage(
                r.error
                  ? r.error.message || "Invalid code."
                  : "Two-factor authentication verified.",
              );
              if (!r.error) setSetup(null);
            }}
            className="inline-form"
          >
            <input
              name="code"
              placeholder="6-digit authenticator code"
              aria-label="Authenticator code"
              autoComplete="one-time-code"
              required
            />
            <button className="button primary">Verify and enable</button>
          </form>
        </div>
      )}
      {message && (
        <p className="record-form" role="status">
          {message}
        </p>
      )}
    </Panel>
  );
}
export function TwoFactorChallenge() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>Verify your sign-in.</h1>
        <p>Enter a code from your authenticator.</p>
        <form
          className="inline-form"
          action={async (f) => {
            const r = await authClient.twoFactor.verifyTotp({
              code: String(f.get("code")),
            });
            if (r.error) setError(r.error.message || "Verification failed.");
            else {
              router.push("/app");
              router.refresh();
            }
          }}
        >
          <input
            name="code"
            aria-label="Authenticator code"
            autoComplete="one-time-code"
            required
          />
          <button className="button primary">Verify</button>
        </form>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
