import { context } from "@/server/context";
import { apiError } from "@/server/errors";
import { paymentReceipt } from "@/server/receipts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await paymentReceipt(await context(), (await params).id),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
