import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { updateSettings } from "@/server/settings";
export async function PATCH(request: Request) {
  try {
    await csrf(request);
    return Response.json(
      await updateSettings(await context(), await request.json()),
    );
  } catch (error) {
    return apiError(error);
  }
}
