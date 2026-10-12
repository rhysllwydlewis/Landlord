import { context } from "@/server/context";
import { apiError } from "@/server/errors";
import { financialReport } from "@/server/reports";
export async function GET(request: Request) {
  try {
    return Response.json(
      await financialReport(await context(), new URL(request.url).searchParams),
    );
  } catch (e) {
    return apiError(e);
  }
}
