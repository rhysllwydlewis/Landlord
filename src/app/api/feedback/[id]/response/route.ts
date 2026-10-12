import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { respondToFeedback } from "@/server/feedback";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await csrf(request);
    return Response.json(
      await respondToFeedback(
        await context(),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
