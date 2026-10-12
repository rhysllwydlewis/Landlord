import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import { invariant } from "./errors";
export async function rateLimit(
  identity: string,
  limit = 120,
  windowMs = 60000,
) {
  const key = "app:" + createHash("sha256").update(identity).digest("hex");
  const now = BigInt(Date.now());
  const result = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("id","key","count","lastRequest") VALUES (${randomUUID()},${key},1,${now}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."lastRequest" < ${now - BigInt(windowMs)} THEN 1 ELSE "RateLimit"."count"+1 END, "lastRequest" = CASE WHEN "RateLimit"."lastRequest" < ${now - BigInt(windowMs)} THEN ${now} ELSE "RateLimit"."lastRequest" END RETURNING "count"`;
  invariant(
    result[0].count <= limit,
    429,
    "Too many requests. Please try again shortly.",
  );
}
