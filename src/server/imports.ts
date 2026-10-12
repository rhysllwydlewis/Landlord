import { parse } from "csv-parse/sync";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { permit, checkProperty, checkTenancy, type Context } from "./context";
import { entitlement, checkLimit } from "./entitlements";
import { invariant } from "./errors";
import {
  propertySchema,
  tenantSchema,
  tenancySchema,
  expenseSchema,
} from "./schemas";
import { paymentInput, generateRent } from "./ledger";
import { outstanding, allocate } from "@/lib/calculations";
export const importSchemas = {
  properties: propertySchema,
  tenants: tenantSchema,
  tenancies: tenancySchema,
  payments: paymentInput,
  expenses: expenseSchema,
};
export type ImportType = keyof typeof importSchemas;
const domain = (type: ImportType) =>
  type === "payments"
    ? "rent"
    : type === "expenses"
      ? "finance"
      : type === "properties"
        ? "properties"
        : type === "tenants"
          ? "tenants"
          : "tenancies";
export function validateImport(
  type: ImportType,
  raw: Record<string, unknown>[],
  mapping: Record<string, string>,
) {
  return raw.map((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const [field, column] of Object.entries(mapping)) {
      const v = row[column];
      if (v === undefined || v === "") continue;
      mapped[field] = field.endsWith("Pence")
        ? Math.round(Number(v) * 100)
        : ["bedrooms", "bathrooms", "dueDay"].includes(field)
          ? Number(v)
          : field === "tenantIds"
            ? String(v)
                .split(";")
                .map((x) => x.trim())
                .filter(Boolean)
            : String(v);
    }
    if (type === "payments") mapped.idempotencyKey = randomUUID();
    const result = importSchemas[type].safeParse(mapped);
    return {
      row: index + 2,
      data: result.success ? result.data : mapped,
      errors: result.success
        ? []
        : result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  });
}
export async function previewImport(ctx: Context, raw: unknown) {
  const x = z
    .object({
      type: z.enum([
        "properties",
        "tenants",
        "tenancies",
        "payments",
        "expenses",
      ]),
      csv: z.string().max(2 * 1024 * 1024),
      mapping: z.record(z.string(), z.string()),
    })
    .parse(raw);
  permit(ctx, domain(x.type), true);
  await entitlement(
    ctx,
    x.type === "expenses" ? "finance" : x.type === "payments" ? "rent" : "core",
  );
  const rows = parse(x.csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, unknown>[];
  invariant(
    rows.length > 0 && rows.length <= 500,
    422,
    "Import between 1 and 500 rows per batch.",
  );
  const prepared = validateImport(x.type, rows, x.mapping);
  const seen = new Set<string>();
  for (const p of prepared) {
    if (p.errors.length) continue;
    const d = p.data as Record<string, unknown>;
    const key =
      x.type === "properties"
        ? `${d.address}|${d.postcode}`
        : x.type === "tenants"
          ? String(d.email)
          : x.type === "tenancies"
            ? String(d.reference)
            : `${d.reference || d.invoiceReference || d.description}|${d.amountPence}|${d.paidAt || d.incurredAt}`;
    if (seen.has(key)) p.errors.push("Duplicate row in this import.");
    seen.add(key);
    if (
      x.type === "properties" &&
      (await db.property.findFirst({
        where: {
          organisationId: ctx.organisationId,
          address: String(d.address),
          postcode: String(d.postcode),
        },
      }))
    )
      p.errors.push("A matching property already exists.");
    if (
      x.type === "tenants" &&
      (await db.tenant.findUnique({
        where: {
          organisationId_email: {
            organisationId: ctx.organisationId,
            email: String(d.email),
          },
        },
      }))
    )
      p.errors.push("A tenant with this email already exists.");
    if (
      x.type === "tenancies" &&
      (await db.tenancy.findUnique({
        where: {
          organisationId_reference: {
            organisationId: ctx.organisationId,
            reference: String(d.reference),
          },
        },
      }))
    )
      p.errors.push("This tenancy reference already exists.");
    try {
      if (d.propertyId)
        await checkProperty(ctx, String(d.propertyId), domain(x.type));
      if (x.type === "payments")
        await checkTenancy(ctx, String(d.tenancyId), "rent", true);
    } catch {
      p.errors.push("A linked property or tenancy is unavailable.");
    }
  }
  const job = await db.importJob.create({
    data: {
      organisationId: ctx.organisationId,
      type: x.type,
      rows: JSON.parse(JSON.stringify(prepared.map((p) => p.data))),
      errors: prepared.map((p) => ({ row: p.row, errors: p.errors })),
      mapping: x.mapping,
      createdByUserId: ctx.userId,
    },
  });
  return {
    id: job.id,
    preview: prepared,
    valid: prepared.every((p) => !p.errors.length),
  };
}
export async function commitImport(ctx: Context, id: string) {
  const job = await db.importJob.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      createdByUserId: ctx.userId,
      status: "preview",
    },
  });
  invariant(job, 404, "Import preview not found.");
  invariant(
    Object.hasOwn(importSchemas, job.type),
    422,
    "Unsupported import type.",
  );
  const type = job.type as ImportType;
  permit(ctx, domain(type), true);
  await entitlement(
    ctx,
    type === "expenses" ? "finance" : type === "payments" ? "rent" : "core",
  );
  invariant(
    (job.errors as { errors: string[] }[]).every((x) => !x.errors.length),
    422,
    "Correct validation errors and create a new preview.",
  );
  const rows = job.rows as Record<string, unknown>[];
  if (type === "properties") await checkLimit(ctx, "property", rows.length);
  const ids = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
      if (type === "properties")
        await checkLimit(ctx, "property", rows.length, tx);
      const locked = await tx.importJob.updateMany({
        where: { id, status: "preview" },
        data: { status: "committing" },
      });
      invariant(locked.count, 409, "This import is already being processed.");
      const created: string[] = [];
      for (const raw of rows) {
        let record: { id: string };
        switch (type) {
          case "properties": {
            const x = propertySchema.parse(raw);
            invariant(
              !(await tx.property.findFirst({
                where: {
                  organisationId: ctx.organisationId,
                  address: x.address,
                  postcode: x.postcode,
                },
              })),
              409,
              "A matching property now exists.",
            );
            record = await tx.property.create({
              data: { ...x, organisationId: ctx.organisationId },
            });
            break;
          }
          case "tenants":
            record = await tx.tenant.create({
              data: {
                ...tenantSchema.parse(raw),
                organisationId: ctx.organisationId,
              },
            });
            break;
          case "tenancies": {
            const { tenantIds, ...x } = tenancySchema.parse(raw);
            await checkProperty(ctx, x.propertyId, "tenancies");
            await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${x.propertyId} AND "organisationId"=${ctx.organisationId} FOR UPDATE`;
            invariant(
              !(
                await tx.property.findUniqueOrThrow({
                  where: { id: x.propertyId },
                })
              ).archivedAt,
              409,
              "Archived properties cannot receive new tenancies.",
            );
            invariant(
              (await tx.tenant.count({
                where: {
                  id: { in: tenantIds },
                  organisationId: ctx.organisationId,
                },
              })) === new Set(tenantIds).size,
              422,
              "Invalid tenants.",
            );
            if (x.unitId)
              invariant(
                await tx.unit.findFirst({
                  where: {
                    id: x.unitId,
                    organisationId: ctx.organisationId,
                    propertyId: x.propertyId,
                  },
                }),
                422,
                "Invalid unit.",
              );
            invariant(
              !(await tx.tenancy.findFirst({
                where: {
                  organisationId: ctx.organisationId,
                  propertyId: x.propertyId,
                  status: { in: ["active", "periodic", "ending"] },
                  OR: x.unitId
                    ? [{ unitId: x.unitId }, { unitId: null }]
                    : undefined,
                },
              })),
              409,
              "The property or room is already occupied.",
            );
            record = await tx.tenancy.create({
              data: {
                ...x,
                initialRentPence: x.rentPence,
                organisationId: ctx.organisationId,
                startDate: new Date(x.startDate),
                endDate: x.endDate ? new Date(x.endDate) : undefined,
                participants: {
                  create: tenantIds.map((tenantId) => ({ tenantId })),
                },
                deposit: { create: { amountPence: x.depositPence } },
              },
            });
            break;
          }
          case "expenses": {
            const x = expenseSchema.parse(raw);
            await checkProperty(ctx, x.propertyId, "finance");
            invariant(
              !(await tx.expense.findFirst({
                where: {
                  organisationId: ctx.organisationId,
                  propertyId: x.propertyId,
                  description: x.description,
                  amountPence: x.amountPence,
                  incurredAt: new Date(x.incurredAt),
                },
              })),
              409,
              "A matching expense exists.",
            );
            if (x.repairId)
              invariant(
                await tx.repair.findFirst({
                  where: {
                    id: x.repairId,
                    organisationId: ctx.organisationId,
                    propertyId: x.propertyId,
                  },
                }),
                422,
                "Invalid repair.",
              );
            record = await tx.expense.create({
              data: {
                ...x,
                organisationId: ctx.organisationId,
                incurredAt: new Date(x.incurredAt),
              },
            });
            break;
          }
          case "payments": {
            const x = paymentInput.parse(raw);
            await checkTenancy(ctx, x.tenancyId, "rent", true);
            invariant(
              !(await tx.payment.findFirst({
                where: {
                  organisationId: ctx.organisationId,
                  tenancyId: x.tenancyId,
                  reference: x.reference,
                  paidAt: new Date(x.paidAt),
                  amountPence: x.amountPence,
                },
              })),
              409,
              "A matching payment exists.",
            );
            const obligations = await tx.rentObligation.findMany({
              where: {
                organisationId: ctx.organisationId,
                tenancyId: x.tenancyId,
              },
              include: { allocations: true },
              orderBy: { dueDate: "asc" },
            });
            const result = allocate(
              x.amountPence,
              obligations.map((o) => ({
                id: o.id,
                balance: outstanding(o.amountPence, o.allocations),
              })),
            );
            record = await tx.payment.create({
              data: {
                ...x,
                organisationId: ctx.organisationId,
                paidAt: new Date(x.paidAt),
                allocations: {
                  create: result.allocations.map((a) => ({ ...a })),
                },
              },
            });
            break;
          }
        }
        created.push(record.id);
      }
      await tx.importJob.update({
        where: { id },
        data: { status: "completed", createdIds: created },
      });
      await tx.auditLog.create({
        data: {
          organisationId: ctx.organisationId,
          actorUserId: ctx.userId,
          action: "import.completed",
          resourceType: "import",
          resourceId: id,
          metadata: { type, count: created.length },
        },
      });
      return created;
    },
    { isolationLevel: "Serializable", timeout: 60000 },
  );
  if (type === "tenancies")
    for (const id of ids) await generateRent(ctx.organisationId, id);
  return { id, count: ids.length };
}
