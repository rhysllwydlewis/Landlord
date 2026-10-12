import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetup } from "@/components/two-factor";
import { Panel } from "@/components/ui";
import { sessionUser } from "@/server/context";
import { db } from "@/server/db";

export default async function Page() {
  let user;
  try {
    user = await sessionUser();
  } catch {
    redirect("/login");
  }
  const account = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { twoFactorEnabled: true },
  });
  return (
    <main className="onboarding-page" id="main" tabIndex={-1}>
      <div className="onboarding-card">
        <Link href="/onboarding" className="back-link">
          ← Back to workspace setup
        </Link>
        <h1>Account security</h1>
        <p>
          Protect your account before or after creating a workspace. Adding an
          authenticator does not grant administrator access.
        </p>
        {account.twoFactorEnabled ? (
          <Panel title="Two-factor authentication">
            <p className="record-form" role="status">
              Two-factor authentication is enabled for your account.
            </p>
          </Panel>
        ) : (
          <TwoFactorSetup />
        )}
      </div>
    </main>
  );
}
