import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { uploadDocument } from "@/server/documents";
export async function POST(request: Request) {
  try {
    await csrf(request);
    return Response.json(
      await uploadDocument(await context(), await request.formData()),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
