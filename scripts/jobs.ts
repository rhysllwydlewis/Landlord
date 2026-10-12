import "dotenv/config";
import { schedule, processJobs } from "../src/server/jobs";
import { db } from "../src/server/db";
async function main() {
  await schedule();
  await processJobs();
}
main()
  .then(() => db.$disconnect())
  .catch(async () => {
    console.error("Job worker failed.");
    await db.$disconnect();
    process.exitCode = 1;
  });
