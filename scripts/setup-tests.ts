import "dotenv/config";
import { writeFile, readFile } from "node:fs/promises";
const base = process.env.DATABASE_URL;
if (!base) throw new Error("Configure DATABASE_URL first.");
const url = new URL(base);
url.pathname = "/platform_test";
const source = await readFile(".env", "utf8");
await writeFile(
  ".env.test",
  source.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url.toString()}`),
  { mode: 0o600 },
);
console.log(
  "Wrote ignored .env.test. Create the dedicated platform_test database, then migrate it.",
);
