import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { randomUUID } from "node:crypto";
import { brand } from "@/lib/config";
export async function queueEmail(
  to: string,
  subject: string,
  text: string,
  organisationId?: string,
  dedupeKey: string = randomUUID(),
  resource?: { userId: string; resourceType?: string; resourceId?: string },
  client: Prisma.TransactionClient = db,
) {
  await client.backgroundJob.upsert({
    where: { dedupeKey },
    create: {
      organisationId,
      type: "email",
      dedupeKey,
      payload: { ...resource, to, subject: `${brand.name}: ${subject}`, text },
    },
    update: {},
  });
}
