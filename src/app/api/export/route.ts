import { stringify } from "csv-stringify/sync";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { context, permit, audit } from "@/server/context";
import { apiError, invariant } from "@/server/errors";
import { listResource } from "@/server/resources";
import { financialReport } from "@/server/reports";
import { brand } from "@/lib/config";
import { money } from "@/lib/calculations";
function safe(v: unknown): string | number | boolean {
  if (typeof v === "string") return /^[=+@\-\t\r]/.test(v) ? `'${v}` : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  return v === null || v === undefined ? "" : JSON.stringify(v);
}
export async function GET(request: Request) {
  try {
    const ctx = await context();
    const params = new URL(request.url).searchParams;
    const resource = params.get("resource") || "report";
    if (ctx.role !== "STAKEHOLDER") permit(ctx, "reports");
    let rows: Record<string, unknown>[] = [];
    let basis = "";
    if (resource === "report") {
      const report = await financialReport(ctx, params);
      rows = report.rows;
      basis = report.basis;
    } else {
      invariant(
        ctx.role !== "STAKEHOLDER",
        403,
        "Only owner statements may be exported.",
      );
      for (let page = 1; page <= 334; page++) {
        params.set("page", String(page));
        const data = await listResource(ctx, resource, params);
        rows.push(...(data.rows as Record<string, unknown>[]));
        if (page >= data.pages) break;
        invariant(
          data.total <= 10000,
          422,
          "Narrow the filters to at most 10,000 records.",
        );
      }
    }
    await audit(ctx, "data.exported", resource, "export", {
      count: rows.length,
    });
    if (params.get("format") === "pdf") {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let page = pdf.addPage([595, 842]);
      let y = 790;
      const draw = (line: string) => {
        const text = line.replace(/[^\x20-\x7E]/g, " ");
        for (let offset = 0; offset < Math.max(1, text.length); offset += 85) {
          if (y < 60) {
            page = pdf.addPage([595, 842]);
            y = 790;
          }
          page.drawText(text.slice(offset, offset + 85), {
            x: 40,
            y,
            size: 10,
            font,
            color: rgb(0.15, 0.2, 0.18),
          });
          y -= 18;
        }
      };
      draw(brand.name + " - " + resource);
      draw(basis);
      for (const row of rows) {
        draw(
          Object.entries(row)
            .map(
              ([k, v]) =>
                `${k.replace("Pence", "")}: ${k.endsWith("Pence") ? money(Number(v)) : safe(v)}`,
            )
            .join(" | "),
        );
      }
      return new Response(new Uint8Array(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${resource}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const csv = stringify(
      rows.map((r) =>
        Object.fromEntries(
          Object.entries(r)
            .filter(
              ([k]) =>
                ![
                  "storageKey",
                  "checksum",
                  "internalNotes",
                  "details",
                ].includes(k),
            )
            .map(([k, v]) => [k, safe(v)]),
        ),
      ),
      { header: true },
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${resource}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
