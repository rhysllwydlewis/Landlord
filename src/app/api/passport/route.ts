import { stringify } from "csv-stringify/sync";
import { context, audit } from "@/server/context";
import { db } from "@/server/db";
import { apiError, invariant } from "@/server/errors";
export async function GET(request: Request) {
  try {
    const ctx = await context();
    invariant(ctx.role === "TENANT", 403, "Tenant account required.");
    const entries = await db.operationRecord.findMany({
      where: {
        organisationId: ctx.organisationId,
        userId: ctx.userId,
        kind: "passport",
      },
      select: { title: true, data: true, createdAt: true },
    });
    const rows: Record<string, string | number>[] = [];
    for (const entry of entries) {
      const d = entry.data as {
        source: string;
        description: string;
        shared: boolean;
        consent: boolean;
      };
      if (d.shared && d.consent)
        rows.push({
          source: "Self-reported by tenant",
          title: entry.title,
          description: d.description,
          amountPence: "",
          date: entry.createdAt.toISOString().slice(0, 10),
        });
    }
    if (new URL(request.url).searchParams.get("includePayments") === "true") {
      const payments = await db.payment.findMany({
        where: {
          organisationId: ctx.organisationId,
          tenancyId: { in: ctx.tenancyIds },
        },
        take: 10000,
        orderBy: { paidAt: "asc" },
        select: {
          paidAt: true,
          amountPence: true,
          reference: true,
          tenancy: { select: { reference: true } },
        },
      });
      for (const p of payments)
        rows.push({
          source:
            "Platform tenancy ledger - manually recorded, not bank-verified or individual payer verification",
          title: p.tenancy.reference,
          description: p.reference,
          amountPence: p.amountPence,
          date: p.paidAt.toISOString().slice(0, 10),
        });
    }
    await audit(ctx, "passport.exported", "user", ctx.userId, {
      count: rows.length,
    });
    const safe = rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? `'${v}` : v,
        ]),
      ),
    );
    return new Response(stringify(safe, { header: true }), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rental-history.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
