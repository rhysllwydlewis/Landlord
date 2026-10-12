import { PDFDocument, StandardFonts } from "pdf-lib";
import { context, permit, linkedPropertyScope, audit } from "@/server/context";
import { db } from "@/server/db";
import { apiError, invariant } from "@/server/errors";
import { downloadDocument } from "@/server/documents";
import { money, date } from "@/lib/calculations";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await context();
    permit(ctx, "tenancies");
    permit(ctx, "documents");
    const id = (await params).id;
    const deposit = await db.deposit.findFirst({
      where: {
        id,
        organisationId: ctx.organisationId,
        tenancy: { ...linkedPropertyScope(ctx) },
      },
      include: {
        responses: {
          orderBy: { createdAt: "asc" },
          include: { tenant: { select: { name: true } } },
        },
        tenancy: {
          include: {
            property: { select: { name: true, address: true } },
            participants: { select: { tenant: { select: { name: true } } } },
          },
        },
      },
    });
    invariant(deposit, 404, "Deposit not found.");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage();
    let y = 780;
    const line = (value: string) => {
      for (let i = 0; i < value.length; i += 90) {
        if (y < 60) {
          page = pdf.addPage();
          y = 780;
        }
        page.drawText(value.slice(i, i + 90).replace(/[^\x20-\x7e]/g, " "), {
          x: 40,
          y,
          font,
          size: 11,
        });
        y -= 20;
      }
    };
    line("Deposit evidence pack - administrative records");
    line("Created " + date(new Date()));
    line("Tenancy " + deposit.tenancy.reference);
    line(
      deposit.tenancy.property.name + " - " + deposit.tenancy.property.address,
    );
    line(
      "Participants: " +
        deposit.tenancy.participants.map((p) => p.tenant.name).join(", "),
    );
    line(
      "Deposit " +
        money(deposit.amountPence) +
        "; returned " +
        money(deposit.returnedPence),
    );
    line("Scheme " + deposit.scheme + "; reference " + deposit.reference);
    line("Status " + deposit.status);
    line("Scheme information is manually recorded, not provider confirmation.");
    line(
      "Tenant responses are recorded positions, not automatic deduction approval.",
    );
    for (const response of deposit.responses) {
      line(
        `${date(response.createdAt)} - ${response.tenant.name}: ${response.decision}`,
      );
      line(response.body);
      line(`Proposal reference: ${response.proposalHash}`);
    }
    await pdf.attach(
      new TextEncoder().encode(
        JSON.stringify(
          {
            deposit: {
              amountPence: deposit.amountPence,
              scheme: deposit.scheme,
              reference: deposit.reference,
              status: deposit.status,
              deductions: deposit.deductions,
            },
            tenantResponses: deposit.responses,
          },
          null,
          2,
        ),
      ),
      "recorded-deposit-evidence.json",
      {
        mimeType: "application/json",
        description:
          "Original recorded text and response history, preserving Unicode characters.",
      },
    );
    const deductions = deposit.deductions as {
      description: string;
      amountPence: number;
      accepted: boolean;
      tenantResponse: string;
      documentIds: string[];
    }[];
    for (const deduction of deductions) {
      line(
        deduction.description +
          ": " +
          money(deduction.amountPence) +
          " - " +
          (deduction.accepted ? "agreed" : "proposed"),
      );
      line("Tenant response: " + deduction.tenantResponse);
    }
    const evidence = [
      ...new Set(deductions.flatMap((d) => d.documentIds)),
    ].slice(0, 50);
    for (const docId of evidence) {
      try {
        const response = await downloadDocument(ctx, docId);
        const bytes = await response.arrayBuffer();
        const type = response.headers.get("content-type");
        if (type === "application/pdf") {
          const source = await PDFDocument.load(bytes);
          const pages = await pdf.copyPages(source, source.getPageIndices());
          for (const p of pages) pdf.addPage(p);
        } else if (type === "image/jpeg" || type === "image/png") {
          const image =
            type === "image/jpeg"
              ? await pdf.embedJpg(bytes)
              : await pdf.embedPng(bytes);
          const p = pdf.addPage();
          const size = image.scale(
            Math.min(515 / image.width, 720 / image.height),
          );
          p.drawImage(image, {
            x: 40,
            y: 40,
            width: size.width,
            height: size.height,
          });
        } else line(`Evidence ${docId}: download the original from Documents.`);
      } catch {
        line(
          `Evidence ${docId}: file unavailable or cannot be embedded. Review the original separately.`,
        );
      }
    }
    await audit(ctx, "deposit.evidence.exported", "deposit", id);
    return new Response(new Uint8Array(await pdf.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="deposit-evidence.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
