import { notFound } from "next/navigation";
import { context, permit, propertyScope } from "@/server/context";
import { options, can } from "@/server/dashboard";
import { repairWhere } from "@/server/repairs";
import { db } from "@/server/db";
import { PropertyDetail } from "@/components/property-detail";
import {
  financialPropertyDetails,
  availableUnitScope,
} from "@/server/properties";
import type { Prisma } from "@/generated/prisma/client";
export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await context();
  const id = (await params).id;
  if (!["TENANT", "STAKEHOLDER"].includes(ctx.role)) permit(ctx, "properties");
  const p = await db.property.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      AND: [
        propertyScope(ctx),
        ...(ctx.role === "TENANT"
          ? [{ id: { in: ctx.activePropertyIds } }]
          : []),
      ],
    },
    include: {
      units: {
        where:
          ctx.role === "TENANT"
            ? availableUnitScope(ctx)
            : ctx.role === "STAKEHOLDER"
              ? { archivedAt: null }
              : {},
        orderBy: { name: "asc" },
      },
      portfolio: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      documents: {
        where: {
          archivedAt: null,
          ...(ctx.role === "STAFF" && !can(ctx, "documents")
            ? { id: "unavailable" }
            : {}),
          ...(ctx.role === "STAKEHOLDER" ? { ownerVisible: true } : {}),
          ...(ctx.role === "TENANT"
            ? {
                visibility: "shared",
                grants: { some: { tenantId: { in: ctx.tenantIds } } },
                OR: [{ repairId: null }, { repair: repairWhere(ctx) }],
              }
            : {}),
        },
        select: { id: true, name: true, category: true },
      },
    },
  });
  if (!p) notFound();
  const data =
    ctx.role === "TENANT" || ctx.role === "STAKEHOLDER"
      ? {
          id: p.id,
          name: p.name,
          address: p.address,
          postcode: p.postcode,
          type: p.type,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          furnishing: p.furnishing,
          epcRating: p.epcRating,
          jurisdiction: p.jurisdiction,
          units: p.units,
          documents:
            ctx.role === "STAKEHOLDER" &&
            !ctx.permissions.includes("documents:read")
              ? []
              : p.documents,
        }
      : {
          ...p,
          ...(!can(ctx, "finance")
            ? {
                purchasePricePence: undefined,
                valuePence: undefined,
                details: Object.fromEntries(
                  Object.entries(p.details as Prisma.JsonObject).filter(
                    ([key]) => !financialPropertyDetails.some((k) => k === key),
                  ),
                ),
              }
            : {}),
          history: await db.auditLog.findMany({
            where: {
              organisationId: ctx.organisationId,
              resourceType: "property",
              resourceId: id,
            },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: { id: true, action: true, createdAt: true },
          }),
        };
  return (
    <PropertyDetail
      property={JSON.parse(JSON.stringify(data))}
      options={await options(ctx)}
      editable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("properties:write"))
      }
      documentEditable={
        ctx.role === "OWNER" ||
        (ctx.role === "STAFF" && ctx.permissions.includes("documents:write"))
      }
      allowedModules={
        ctx.role === "OWNER"
          ? [
              "tenancies",
              "repairs",
              "compliance",
              "expenses",
              "documents",
              "tasks",
            ]
          : ctx.role === "TENANT"
            ? ["tenancies", "repairs", "documents"]
            : [
                "tenancies",
                "repairs",
                "compliance",
                "expenses",
                "documents",
                "tasks",
              ].filter((m) => can(ctx, m === "expenses" ? "finance" : m))
      }
      tenant={ctx.role === "TENANT" || ctx.role === "STAKEHOLDER"}
    />
  );
}
