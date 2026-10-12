import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { billingAction } from "@/server/billing";
export async function POST(request: Request) {
  try {
    await csrf(request);
    return Response.json(
      await billingAction(await context(), await request.json()),
    );
  } catch (e) {
    return apiError(e);
  }
}
