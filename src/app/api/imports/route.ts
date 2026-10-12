import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { previewImport, commitImport } from "@/server/imports";
export async function POST(request: Request) {
  try {
    await csrf(request);
    const body = await request.json();
    const ctx = await context();
    return Response.json(
      body.action === "commit"
        ? await commitImport(ctx, body.id)
        : await previewImport(ctx, body),
    );
  } catch (e) {
    return apiError(e);
  }
}
