import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { getDepositDetail, respondToDeposit } from "@/server/deposits";
type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Params) {
  try {
    return Response.json(
      await getDepositDetail(await context(), (await params).id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, { params }: Params) {
  try {
    await csrf(request);
    return Response.json(
      await respondToDeposit(
        await context(),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
