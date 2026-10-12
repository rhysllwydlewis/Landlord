import { context } from "@/server/context";
import { apiError } from "@/server/errors";
import { earlierMessages } from "@/server/messages";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await earlierMessages(
        await context(),
        (await params).id,
        new URL(request.url).searchParams.get("before") || undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
