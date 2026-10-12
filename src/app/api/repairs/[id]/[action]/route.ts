import { context, csrf } from "@/server/context";
import { apiError, invariant } from "@/server/errors";
import { setRepairVisibility, commentRepair } from "@/server/repairs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    await csrf(request);
    const { id, action } = await params;
    invariant(
      ["visibility", "comments"].includes(action),
      404,
      "Action not found.",
    );
    return Response.json(
      await (action === "visibility" ? setRepairVisibility : commentRepair)(
        await context(),
        id,
        await request.json(),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
