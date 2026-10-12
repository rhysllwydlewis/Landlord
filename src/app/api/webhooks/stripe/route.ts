import { stripeWebhook } from "@/server/billing";
import { apiError } from "@/server/errors";
export async function POST(request: Request) {
  try {
    return Response.json(
      await stripeWebhook(
        await request.text(),
        request.headers.get("stripe-signature") || "",
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
