import Link from "next/link";
export default function NotFound() {
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <span className="eyebrow">404</span>
        <h1>That record isn’t available.</h1>
        <p>It may not exist or you may not have access.</p>
        <Link href="/app" className="button primary">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
