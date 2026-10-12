import { redirect } from "next/navigation";
import { context } from "@/server/context";
import { db } from "@/server/db";
import { hasUnreadNotifications } from "@/server/notifications";
import { Shell } from "@/components/shell";
import type { ReactNode } from "react";
export default async function Layout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await context();
  } catch {
    redirect("/onboarding");
  }
  const [org, memberships, unread, user] = await Promise.all([
    db.organisation.findUniqueOrThrow({
      where: { id: ctx.organisationId },
      select: { id: true, name: true },
    }),
    db.membership.findMany({
      where: { userId: ctx.userId, active: true },
      select: { organisation: { select: { id: true, name: true } } },
    }),
    hasUnreadNotifications(ctx),
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { platformAdmin: true },
    }),
  ]);
  return (
    <Shell
      role={ctx.role}
      permissions={ctx.permissions}
      userName={ctx.name}
      organisation={org}
      organisations={memberships.map((m) => m.organisation)}
      unread={unread}
      admin={user?.platformAdmin || false}
    >
      {children}
    </Shell>
  );
}
