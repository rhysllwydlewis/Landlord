import { csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { adminAction } from "@/server/admin";
export async function POST(request: Request) {
  try {
    await csrf(request);
    return Response.json(await adminAction(await request.json()));
  } catch (e) {
    return apiError(e);
  }
}
