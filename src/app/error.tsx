"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>We couldn’t load this page.</h1>
        <p>
          Please try again. If the problem continues, contact your platform
          administrator.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
