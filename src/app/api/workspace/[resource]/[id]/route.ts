import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { updateResource } from "@/server/resources";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    await csrf(request);
    const { resource, id } = await params;
    return Response.json(
      await updateResource(await context(), resource, id, await request.json()),
    );
  } catch (e) {
    return apiError(e);
  }
}
