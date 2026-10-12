"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Building2, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { brand } from "@/lib/config";
export function AuthForm({
  mode,
  token,
  invite,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  token?: string;
  invite?: string;
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const callback = invite
    ? `/invite?token=${encodeURIComponent(invite)}`
    : "/onboarding";
  return (
    <div className="auth-page">
      <Link href="/" className="brand auth-brand">
        <span className="brand-icon">
          <Building2 size={23} />
        </span>
        <span>{brand.name}</span>
      </Link>
      <div className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow">A BETTER WAY TO MANAGE PROPERTY</span>
          <h1>
            A little less admin.
            <br />A lot more clarity.
          </h1>
          <p>
            Your properties, finances and tenant relationships. Connected in one
            thoughtful workspace.
          </p>
          <div className="auth-feature">
            <ShieldCheck size={22} />
            <span>
              Private by default.
              <br />
              <strong>Access controlled by you.</strong>
            </span>
          </div>
          <div className="auth-house-art">
            <Building2 size={180} strokeWidth={0.45} />
          </div>
        </div>
        <div className="auth-card">
          <h2>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Choose a new password"}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to your property workspace."
              : mode === "register"
                ? "Start with your account. Set up your organisation next."
                : "Use a secure password of at least 12 characters."}
          </p>
          {success ? (
            <div className="success-message" role="status">
              {success}
            </div>
          ) : (
            <form
              action={async (f) => {
                setBusy(true);
                setError("");
                try {
                  const email = String(f.get("email") || "");
                  const password = String(f.get("password") || "");
                  if (mode === "register") {
                    const r = await authClient.signUp.email({
                      name: String(f.get("name")),
                      email,
                      password,
                      callbackURL: callback,
                    });
                    if (r.error) throw new Error(r.error.message);
                    setSuccess(
                      "Check your email for the verification link. Your account is created, but access remains locked until you verify it.",
                    );
                  } else if (mode === "login") {
                    const r = await authClient.signIn.email({
                      email,
                      password,
                    });
                    if (r.error) throw new Error(r.error.message);
                    router.push(callback);
                    router.refresh();
                  } else if (mode === "forgot") {
                    const r = await authClient.requestPasswordReset({
                      email,
                      redirectTo: "/reset-password",
                    });
                    if (r.error) throw new Error(r.error.message);
                    setSuccess(
                      "If an account exists for that email, a reset link has been queued.",
                    );
                  } else {
                    const r = await authClient.resetPassword({
                      newPassword: password,
                      token,
                    });
                    if (r.error) throw new Error(r.error.message);
                    setSuccess(
                      "Your password has been updated. You can now sign in.",
                    );
                  }
                } catch (e) {
                  setError((e as Error).message || "Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {mode === "register" && (
                <label className="form-field">
                  <span>Full name</span>
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label className="form-field">
                  <span>Email address</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="form-field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 12}
                    required
                  />
                </label>
              )}
              {mode === "login" && (
                <Link href="/forgot-password" className="text-link">
                  Forgot your password?
                </Link>
              )}
              {mode === "register" && (
                <label className="checkbox-field">
                  <input type="checkbox" required />I agree to the{" "}
                  <Link href="/terms">terms</Link> and{" "}
                  <Link href="/privacy">privacy notice</Link>.
                </label>
              )}
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}{" "}
                {mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
              </button>
            </form>
          )}
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link
                  href={invite ? `/register?invite=${invite}` : "/register"}
                >
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href={invite ? `/login?invite=${invite}` : "/login"}>
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <footer>
        Secure sign-in · <Link href="/privacy">Privacy</Link> ·{" "}
        <Link href="/help">Help & support</Link>
      </footer>
    </div>
  );
}
