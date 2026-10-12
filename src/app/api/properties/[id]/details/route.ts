import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { updatePropertyDetails } from "@/server/properties";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await csrf(request);
    return Response.json(
      await updatePropertyDetails(
        await context(),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
