import "dotenv/config";
import { db } from "../src/server/db";
const email = process.argv[2];
if (!email) throw new Error("Pass the email of an existing verified account.");
const user = await db.user.findUnique({
  where: { email: email.toLowerCase() },
});
if (!user?.emailVerified)
  throw new Error("The account must already exist and have a verified email.");
if (process.env.NODE_ENV === "production" && !user.twoFactorEnabled)
  throw new Error(
    "Enable two-factor authentication before granting production admin access.",
  );
await db.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: user.id },
    data: { platformAdmin: true },
  });
  await tx.auditLog.create({
    data: {
      actorUserId: "operator-bootstrap",
      action: "admin.access.granted",
      resourceType: "user",
      resourceId: user.id,
    },
  });
});
console.log(
  "Administrator access granted to the specified account and audited.",
);
await db.$disconnect();
