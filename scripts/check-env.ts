import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_URL: z.url(),
  STORAGE_DRIVER: z.literal("s3"),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  JOB_SECRET: z.string().min(32),
});
const result = schema.safeParse(process.env);
if (!result.success) {
  console.error(
    "Production configuration is incomplete. Missing or invalid keys: " +
      result.error.issues.map((i) => i.path.join(".")).join(", "),
  );
  process.exitCode = 1;
} else if (
  !result.data.APP_URL.startsWith("https://") ||
  !result.data.BETTER_AUTH_URL.startsWith("https://")
) {
  console.error("Production APP_URL and BETTER_AUTH_URL must use HTTPS.");
  process.exitCode = 1;
} else
  console.log(
    "Required production variable formats are valid. Provider access still requires operational verification.",
  );
