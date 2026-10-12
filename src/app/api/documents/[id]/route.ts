import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { downloadDocument, shareDocument } from "@/server/documents";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await downloadDocument(
      await context(),
      (await params).id,
      new URL(request.url).searchParams.get("preview") === "1",
    );
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
      await shareDocument(
        await context(),
        (await params).id,
        await request.json(),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
