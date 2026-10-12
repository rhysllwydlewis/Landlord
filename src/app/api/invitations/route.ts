import { context, csrf } from "@/server/context";
import { apiError } from "@/server/errors";
import { invite } from "@/server/onboarding";
export async function POST(request: Request) {
  try {
    await csrf(request);
    return Response.json(await invite(await context(), await request.json()));
  } catch (e) {
    return apiError(e);
  }
}
