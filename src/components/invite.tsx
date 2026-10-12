"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/http";
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <span className="eyebrow">YOUR SECURE INVITATION</span>
        <h1>Welcome to your portal.</h1>
        <p>
          Sign in or create an account using the invited email address, verify
          it, then accept your invitation.
        </p>
        <div className="section-links">
          <Link
            className="button secondary"
            href={`/login?invite=${encodeURIComponent(token)}`}
          >
            Sign in
          </Link>
          <Link
            className="button secondary"
            href={`/register?invite=${encodeURIComponent(token)}`}
          >
            Create account
          </Link>
          <button
            className="button primary"
            onClick={async () => {
              try {
                await requestJson("/api/invitations/accept", "POST", { token });
                router.push("/app");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Accept invitation
          </button>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
