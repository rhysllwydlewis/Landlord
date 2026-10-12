import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { db } from "./db";
import {
  permit,
  checkProperty,
  checkTenancy,
  linkedPropertyScope,
  audit,
  type Context,
} from "./context";
import { checkLimit, entitlement } from "./entitlements";
import { getRepair, repairWhere } from "./repairs";
import { invariant } from "./errors";
import { notify } from "./notifications";
const s3 = () =>
  new S3Client({
    region: process.env.S3_REGION || "eu-west-2",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
function driver() {
  const value = process.env.STORAGE_DRIVER || "local";
  invariant(
    value === "s3" || process.env.NODE_ENV !== "production",
    503,
    "Private object storage is not configured.",
  );
  return value;
}
function validContent(buf: Buffer, type: string) {
  return type === "application/pdf"
    ? buf.subarray(0, 5).toString() === "%PDF-"
    : type === "image/png"
      ? buf
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : type === "image/jpeg"
        ? buf[0] === 255 && buf[1] === 216 && buf[2] === 255
        : type === "image/webp"
          ? buf.subarray(0, 4).toString() === "RIFF" &&
            buf.subarray(8, 12).toString() === "WEBP"
          : false;
}
export async function uploadDocument(ctx: Context, form: FormData) {
  await entitlement(ctx, "documents");
  const file = form.get("file");
  invariant(
    file instanceof File && file.size > 0 && file.size <= 10 * 1024 * 1024,
    422,
    "Choose a PDF, JPEG, PNG or WebP file up to 10 MB.",
  );
  const input = z
    .object({
      propertyId: z.string().optional(),
      tenancyId: z.string().optional(),
      repairId: z.string().optional(),
      category: z.string().min(1).max(100),
      tenantIds: z.array(z.string()).max(100).default([]),
      ownerVisible: z.boolean().default(false),
    })
    .parse({
      propertyId: form.get("propertyId") || undefined,
      tenancyId: form.get("tenancyId") || undefined,
      repairId: form.get("repairId") || undefined,
      category: form.get("category") || "General",
      ownerVisible: form.get("ownerVisible") === "on",
      tenantIds: JSON.parse(String(form.get("tenantIds") || "[]")),
    });
  if (ctx.role === "TENANT") {
    invariant(
      input.repairId || input.tenancyId,
      422,
      "Link this file to your repair or tenancy.",
    );
    if (input.repairId) await getRepair(ctx, input.repairId);
    if (input.tenancyId) await checkTenancy(ctx, input.tenancyId, "documents");
    input.tenantIds = ctx.tenantIds;
    input.ownerVisible = false;
    input.propertyId = undefined;
  } else {
    permit(ctx, "documents", true);
    if (input.propertyId)
      await checkProperty(ctx, input.propertyId, "documents");
    if (input.tenancyId)
      await checkTenancy(ctx, input.tenancyId, "documents", true);
    if (input.repairId) {
      const r = await getRepair(ctx, input.repairId);
      invariant(
        !input.propertyId || input.propertyId === r.property.id,
        422,
        "Document links must belong to the same property.",
      );
    }
  }
  // Keep all links coherent; independently authorised records may belong to
  // different properties and must not be combined into one document.
  const tenancy = input.tenancyId
    ? await db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
        select: { propertyId: true },
      })
    : null;
  const repair = input.repairId
    ? await db.repair.findUniqueOrThrow({
        where: { id: input.repairId },
        select: { propertyId: true, tenancyId: true },
      })
    : null;
  invariant(
    !tenancy || !repair || tenancy.propertyId === repair.propertyId,
    422,
    "Repair and tenancy must belong to the same property.",
  );
  invariant(
    !input.tenancyId ||
      !repair?.tenancyId ||
      input.tenancyId === repair.tenancyId,
    422,
    "Repair and document tenancy must match.",
  );
  const linkedPropertyId = repair?.propertyId || tenancy?.propertyId;
  invariant(
    !input.propertyId ||
      !linkedPropertyId ||
      input.propertyId === linkedPropertyId,
    422,
    "Document links must belong to the same property.",
  );
  input.propertyId = linkedPropertyId || input.propertyId;
  await checkLimit(ctx, "storage", file.size);
  const candidates = await db.tenant.findMany({
    where: {
      organisationId: ctx.organisationId,
      id: { in: input.tenantIds },
      AND: [
        ...(input.propertyId
          ? [
              {
                participants: {
                  some: { tenancy: { propertyId: input.propertyId } },
                },
              },
            ]
          : []),
        ...(input.tenancyId
          ? [{ participants: { some: { tenancyId: input.tenancyId } } }]
          : []),
        ...(ctx.role === "STAFF" && ctx.propertyIds.length
          ? [
              {
                participants: {
                  some: { tenancy: { propertyId: { in: ctx.propertyIds } } },
                },
              },
            ]
          : []),
      ],
      ...(input.repairId
        ? await repairRecipientScope(ctx, input.repairId)
        : {}),
    },
    select: { id: true, userId: true },
  });
  if (ctx.role === "TENANT") input.tenantIds = candidates.map((t) => t.id);
  invariant(
    candidates.length === new Set(input.tenantIds).size,
    422,
    "Invalid document recipients.",
  );
  const buf = Buffer.from(await file.arrayBuffer());
  invariant(
    validContent(buf, file.type),
    422,
    "This file format is not supported or the contents do not match.",
  );
  const key = `${ctx.organisationId}/${randomUUID()}`;
  if (driver() === "s3") {
    invariant(process.env.S3_BUCKET, 503, "Object storage is not configured.");
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buf,
        ContentType: file.type,
        ServerSideEncryption: "AES256",
      }),
    );
  } else {
    const dir = path.join(process.cwd(), "storage", ctx.organisationId);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(process.cwd(), "storage", key), buf, {
      mode: 0o600,
    });
  }
  const d = await db
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id=${ctx.organisationId} FOR UPDATE`;
      await checkLimit(ctx, "storage", file.size, tx);
      return tx.document.create({
        data: {
          organisationId: ctx.organisationId,
          propertyId: input.propertyId,
          tenancyId: input.tenancyId,
          repairId: input.repairId,
          name: file.name.replace(/[\x00-\x1f/\\]/g, "").slice(0, 150),
          category: input.category,
          storageKey: key,
          contentType: file.type,
          size: file.size,
          checksum: createHash("sha256").update(buf).digest("hex"),
          uploadedByUserId: ctx.userId,
          visibility: input.tenantIds.length ? "shared" : "private",
          ownerVisible: input.ownerVisible,
          grants: {
            create: [...new Set(input.tenantIds)].map((tenantId) => ({
              tenantId,
            })),
          },
        },
      });
    })
    .catch(async (error) => {
      try {
        if (driver() === "s3")
          await s3().send(
            new DeleteObjectCommand({
              Bucket: process.env.S3_BUCKET,
              Key: key,
            }),
          );
        else await unlink(path.join(process.cwd(), "storage", key));
      } catch {
        console.warn(
          "Unreferenced upload cleanup failed; operator review required.",
        );
      }
      throw error;
    });
  await audit(ctx, "document.uploaded", "document", d.id);
  await notify(
    ctx.organisationId,
    candidates
      .map((t) => t.userId)
      .filter((x): x is string => !!x && x !== ctx.userId),
    "Document shared",
    "/app/documents",
    `document:${d.id}`,
    "document",
    d.id,
  );
  return { id: d.id };
}
export async function downloadDocument(ctx: Context, id: string) {
  if (ctx.role === "STAKEHOLDER")
    invariant(
      ctx.permissions.includes("documents:read"),
      403,
      "Document access was not granted.",
    );
  else if (ctx.role !== "TENANT") permit(ctx, "documents");
  const d = await db.document.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      archivedAt: null,
      ...(ctx.role === "STAKEHOLDER"
        ? { ownerVisible: true, propertyId: { in: ctx.propertyIds } }
        : {}),
      ...(ctx.role === "STAFF" && ctx.propertyIds.length
        ? linkedPropertyScope(ctx)
        : {}),
      ...(ctx.role === "TENANT"
        ? {
            visibility: "shared",
            grants: { some: { tenantId: { in: ctx.tenantIds } } },
            OR: [{ repairId: null }, { repair: repairWhere(ctx) }],
          }
        : {}),
    },
  });
  invariant(d, 404, "Document not found.");
  await audit(ctx, "document.downloaded", "document", id);
  let body: Uint8Array;
  if (driver() === "s3") {
    const o = await s3().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: d.storageKey,
      }),
    );
    invariant(o.Body, 404, "File unavailable.");
    body = await o.Body.transformToByteArray();
  } else
    body = await readFile(path.join(process.cwd(), "storage", d.storageKey));
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": d.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function shareDocument(ctx: Context, id: string, raw: unknown) {
  permit(ctx, "documents", true);
  await entitlement(ctx, "documents");
  const d = await db.document.findFirst({
    where: {
      id,
      organisationId: ctx.organisationId,
      ...linkedPropertyScope(ctx),
    },
    include: { grants: { select: { tenantId: true } } },
  });
  invariant(d, 404, "Document not found.");
  const x = z
    .object({
      tenantIds: z.array(z.string()).max(100),
      ownerVisible: z.boolean().optional(),
    })
    .parse(raw);
  const tenants = await db.tenant.findMany({
    where: {
      id: { in: x.tenantIds },
      organisationId: ctx.organisationId,
      AND: [
        ...(d.propertyId
          ? [
              {
                participants: {
                  some: { tenancy: { propertyId: d.propertyId } },
                },
              },
            ]
          : []),
        ...(d.tenancyId
          ? [{ participants: { some: { tenancyId: d.tenancyId } } }]
          : []),
      ],
      ...(d.repairId ? await repairRecipientScope(ctx, d.repairId) : {}),
    },
    select: { id: true, userId: true },
  });
  invariant(
    tenants.length === new Set(x.tenantIds).size,
    422,
    "Invalid recipient selection.",
  );
  await db.$transaction(async (tx) => {
    await tx.documentAccess.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        visibility: x.tenantIds.length ? "shared" : "private",
        ownerVisible: x.ownerVisible,
        grants: { create: tenants.map((t) => ({ tenantId: t.id })) },
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId: ctx.organisationId,
        actorUserId: ctx.userId,
        action: "document.visibility.changed",
        resourceType: "document",
        resourceId: id,
        metadata: { tenantIds: x.tenantIds },
      },
    });
    const revoked = await tx.tenant.findMany({
      where: {
        id: {
          in: d.grants
            .filter((g) => !x.tenantIds.includes(g.tenantId))
            .map((g) => g.tenantId),
        },
      },
      select: { userId: true },
    });
    await tx.notification.deleteMany({
      where: {
        organisationId: ctx.organisationId,
        resourceType: "document",
        resourceId: id,
        userId: { in: revoked.flatMap((t) => (t.userId ? [t.userId] : [])) },
      },
    });
    const newUsers = tenants
      .filter((t) => !d.grants.some((g) => g.tenantId === t.id))
      .flatMap((t) => (t.userId ? [t.userId] : []));
    await notify(
      ctx.organisationId,
      newUsers,
      "Document shared",
      "/app/documents",
      `document-shared:${id}:${randomUUID()}`,
      "document",
      id,
      tx,
    );
  });
  return { id };
}
async function repairRecipientScope(ctx: Context, repairId: string) {
  const repair = await db.repair.findFirstOrThrow({
    where: { id: repairId, organisationId: ctx.organisationId },
    select: {
      reportedByTenantId: true,
      grants: { select: { tenantId: true } },
    },
  });
  const ids = [
    ...repair.grants.map((g) => g.tenantId),
    ...(repair.reportedByTenantId ? [repair.reportedByTenantId] : []),
  ];
  return { OR: ids.map((id) => ({ id })) };
}
