import { timingSafeEqual } from "node:crypto";
import { schedule, processJobs } from "@/server/jobs";
import { apiError, invariant } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
export async function POST(request: Request) {
  try {
    const secret = process.env.JOB_SECRET;
    invariant(
      secret && secret.length >= 32,
      503,
      "Scheduled HTTP worker is not configured.",
    );
    const supplied = Buffer.from(request.headers.get("authorization") || "");
    const expected = Buffer.from(`Bearer ${secret}`);
    invariant(
      supplied.length === expected.length &&
        timingSafeEqual(supplied, expected),
      401,
      "Scheduler authentication required.",
    );
    await rateLimit("scheduled-http-worker", 1, 60000);
    await schedule();
    await processJobs();
    return Response.json({ processed: true });
  } catch (e) {
    return apiError(e);
  }
}
