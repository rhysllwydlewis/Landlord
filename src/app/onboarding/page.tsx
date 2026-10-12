import { redirect } from "next/navigation";
import { sessionUser } from "@/server/context";
import { db } from "@/server/db";
import { Onboarding } from "@/components/onboarding";
export default async function Page() {
  let user;
  try {
    user = await sessionUser();
  } catch {
    redirect("/login");
  }
  const m = await db.membership.findFirst({
    where: { userId: user.id, active: true },
    include: { organisation: true },
  });
  if (m && m.role !== "OWNER") redirect("/app");
  return (
    <Onboarding
      step={m?.organisation.onboardingStep || 0}
      organisation={m?.organisation.name}
    />
  );
}
