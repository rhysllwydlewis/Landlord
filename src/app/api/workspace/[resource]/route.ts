import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { listResource, createResource } from "@/server/resources";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    return Response.json(
      await listResource(
        await context(),
        (await params).resource,
        new URL(request.url).searchParams,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    await csrf(request);
    return Response.json(
      await createResource(
        await context(),
        (await params).resource,
        await request.json(),
      ),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
