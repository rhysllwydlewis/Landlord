import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { getRepair, updateRepair } from "@/server/repairs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(await getRepair(await context(), (await params).id));
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await csrf(request);
    return Response.json(
      await updateRepair(
        await context(),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
