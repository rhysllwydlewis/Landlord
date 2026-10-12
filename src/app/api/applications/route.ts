import { z } from "zod";
import { db } from "@/server/db";
import { csrf } from "@/server/context";
import { apiError, invariant } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { notify } from "@/server/notifications";
export async function POST(request: Request) {
  try {
    await csrf(request);
    const x = z
      .object({
        listingId: z.string(),
        name: z.string().trim().min(2).max(120),
        email: z.email().transform((s) => s.toLowerCase()),
        phone: z.string().min(1).max(30),
        message: z.string().max(3000).default(""),
        consent: z.literal(true),
      })
      .parse(await request.json());
    await rateLimit(`enquiry:${x.email}`, 3, 3600000);
    const l = await db.listing.findFirst({
      where: {
        id: x.listingId,
        published: true,
        property: { organisation: { status: "active" } },
      },
    });
    invariant(l, 404, "Listing not available.");
    const a = await db.application.create({
      data: {
        listingId: l.id,
        organisationId: l.organisationId,
        name: x.name,
        email: x.email,
        phone: x.phone,
        details: { message: x.message },
        consentAt: new Date(),
        retentionUntil: new Date(Date.now() + 90 * 86400000),
      },
    });
    const managers = await db.membership.findMany({
      where: {
        organisationId: l.organisationId,
        active: true,
        OR: [
          { role: "OWNER" },
          {
            role: "STAFF",
            permissions: { hasSome: ["lettings:read", "lettings:write"] },
          },
        ],
      },
    });
    await notify(
      l.organisationId,
      managers
        .filter(
          (m) =>
            m.role === "OWNER" ||
            !m.propertyIds.length ||
            m.propertyIds.includes(l.propertyId),
        )
        .map((m) => m.userId),
      "New rental enquiry",
      "/app/applications",
      `application:${a.id}`,
    );
    return Response.json({ received: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
