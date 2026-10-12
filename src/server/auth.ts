import { twoFactor } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { brand } from "@/lib/config";
import { queueEmail } from "./email";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.APP_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await queueEmail(
        user.email,
        "Reset your password",
        `Reset your password using this link: ${url}\nIf you did not request this, ignore this email.`,
      );
    },
    onPasswordReset: async ({ user }) => {
      await db.session.deleteMany({ where: { userId: user.id } });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await queueEmail(
        user.email,
        "Verify your email",
        `Verify your email to continue: ${url}`,
      );
    },
  },
  plugins: [twoFactor({ issuer: brand.name })],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: process.env.NODE_ENV === "development" ? 60 : 10,
      },
      "/sign-up/email": {
        window: 60,
        max: process.env.NODE_ENV === "development" ? 60 : 5,
      },
    },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
});
