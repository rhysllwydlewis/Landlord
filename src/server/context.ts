import { headers, cookies } from "next/headers";
import { rateLimit } from "./rate-limit";
import { auth } from "./auth";
import { db } from "./db";
import { invariant } from "./errors";
import type { Permission } from "@/lib/config";
import type { Role } from "@/generated/prisma/client";
export type Context = {
  userId: string;
  name: string;
  email: string;
  organisationId: string;
  role: Role;
  permissions: string[];
  propertyIds: string[];
  tenantIds: string[];
  tenancyIds: string[];
  activePropertyIds: string[];
};
export async function sessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  invariant(session?.user, 401, "Please sign in.");
  invariant(session.user.emailVerified, 403, "Verify your email first.");
  await rateLimit(`user:${session.user.id}`, 300);
  return session.user;
}
export async function context(): Promise<Context> {
  const user = await sessionUser();
  const selected = (await cookies()).get("organisation")?.value;
  const member = await db.membership.findFirst({
    where: {
      userId: user.id,
      active: true,
      ...(selected ? { organisationId: selected } : {}),
    },
    include: { organisation: true },
    orderBy: { createdAt: "asc" },
  });
  invariant(
    member,
    403,
    "Create an organisation or accept an invitation first.",
  );
  invariant(
    member.organisation.status === "active",
    403,
    "This organisation is currently unavailable.",
  );
  const tenants = await db.tenant.findMany({
    where: { organisationId: member.organisationId, userId: user.id },
    select: {
      id: true,
      participants: {
        select: {
          tenancy: { select: { id: true, propertyId: true, status: true } },
        },
      },
    },
  });
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    organisationId: member.organisationId,
    role: member.role,
    permissions: member.permissions,
    propertyIds: member.propertyIds,
    tenantIds: tenants.map((t) => t.id),
    tenancyIds: tenants.flatMap((t) => t.participants.map((p) => p.tenancy.id)),
    activePropertyIds: [
      ...new Set(
        tenants.flatMap((t) =>
          t.participants
            .filter((p) =>
              ["active", "periodic", "ending"].includes(p.tenancy.status),
            )
            .map((p) => p.tenancy.propertyId),
        ),
      ),
    ],
  };
}
export function permit(ctx: Context, domain: Permission, write = false) {
  invariant(
    ctx.role === "OWNER" ||
      (ctx.role === "STAFF" &&
        ctx.permissions.includes(`${domain}:${write ? "write" : "read"}`)) ||
      (ctx.role === "STAFF" &&
        !write &&
        ctx.permissions.includes(`${domain}:write`)),
    403,
    "You do not have permission for this action.",
  );
}
export function propertyScope(ctx: Context) {
  return ctx.role === "STAKEHOLDER" ||
    (ctx.role === "STAFF" && ctx.propertyIds.length > 0)
    ? { id: { in: ctx.propertyIds } }
    : {};
}
export function linkedPropertyScope(ctx: Context) {
  return ctx.role === "STAKEHOLDER" ||
    (ctx.role === "STAFF" && ctx.propertyIds.length > 0)
    ? { propertyId: { in: ctx.propertyIds } }
    : {};
}
export async function checkProperty(
  ctx: Context,
  id: string,
  domain: Permission = "properties",
  write = true,
) {
  permit(ctx, domain, write);
  const p = await db.property.findFirst({
    where: { id, organisationId: ctx.organisationId, ...propertyScope(ctx) },
  });
  invariant(p, 404, "Property not found.");
  return p;
}
export async function checkTenancy(
  ctx: Context,
  id: string,
  domain: Permission,
  write = false,
) {
  invariant(
    !(write && ctx.role === "TENANT"),
    403,
    "This action is restricted to authorised managers.",
  );
  if (ctx.role !== "TENANT") permit(ctx, domain, write);
  const t = await db.tenancy.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      ...linkedPropertyScope(ctx),
      ...(ctx.role === "TENANT" ? { id: { in: ctx.tenancyIds } } : {}),
    },
    include: { participants: { include: { tenant: true } } },
  });
  invariant(t, 404, "Tenancy not found.");
  return t;
}
export async function audit(
  ctx: Context,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  await db.auditLog.create({
    data: {
      organisationId: ctx.organisationId,
      actorUserId: ctx.userId,
      action,
      resourceType,
      resourceId,
      metadata,
    },
  });
}
export async function csrf(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  invariant(
    origin === new URL(process.env.APP_URL || "http://localhost:3000").origin,
    403,
    "Request origin is not allowed.",
  );
  invariant(
    !request.headers.get("sec-fetch-site") ||
      request.headers.get("sec-fetch-site") !== "cross-site",
    403,
    "Cross-site requests are not allowed.",
  );
}
