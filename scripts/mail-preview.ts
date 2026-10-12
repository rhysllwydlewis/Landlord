import "dotenv/config";
import { db } from "../src/server/db";
if (process.env.NODE_ENV === "production")
  throw new Error("Local email preview is development-only.");
const email = process.argv[2];
if (!email)
  throw new Error(
    "Pass the locally generated development email to preview its outbox.",
  );
const jobs = await db.backgroundJob.findMany({
  where: {
    type: "email",
    status: { in: ["local", "queued"] },
    payload: { path: ["to"], equals: email },
  },
  take: 10,
  orderBy: { createdAt: "desc" },
});
for (const job of jobs) {
  const p = job.payload as { subject: string; text: string };
  console.log(p.subject + "\n" + p.text + "\n");
}
await db.$disconnect();
