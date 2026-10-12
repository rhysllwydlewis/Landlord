import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { db } from "../../src/server/db";

// Decode the standard authenticator URI and calculate an RFC 6238 code locally.
// Never print the setup secret, backup codes or password in test output.
function authenticatorCode(uri: string) {
  const params = new URL(uri).searchParams;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...params.get("secret")!.replace(/=+$/, "")]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const secret = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(
    BigInt(Math.floor(Date.now() / 1000 / Number(params.get("period") || 30))),
  );
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const digits = Number(params.get("digits") || 6);
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}

test("account security requires sign-in", async ({ page }) => {
  await page.goto("/account/security");
  await expect(page).toHaveURL(/\/login$/);
});

test("verified account can enable TOTP before any organisation or plan", async ({
  page,
}) => {
  const email = `bootstrap-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "Bootstrap account" },
  });
  expect(signup.ok()).toBe(true);
  const user = await db.user.update({
    where: { email },
    data: { emailVerified: true },
  });
  expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.getByRole("link", { name: "Account security" }).click();
  await expect(
    page.getByRole("heading", { name: "Account security" }),
  ).toBeVisible();
  await page.getByLabel("Current password").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.locator(".private-code")).toBeVisible();
  const uri = await page.locator(".private-code").textContent();
  await page.getByLabel("Authenticator code").fill(authenticatorCode(uri!));
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await expect(page.getByRole("status")).toContainText(
    "authentication verified",
  );
  const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(updated.twoFactorEnabled).toBe(true);
  expect(updated.platformAdmin).toBe(false);
  expect(await db.membership.count({ where: { userId: user.id } })).toBe(0);
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "enabled for your account",
  );
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toHaveCount(0);
  expect((await page.request.get("/admin")).status()).toBe(404);
  await page.request.post("/api/auth/sign-out");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/two-factor$/);
  expect((await page.request.get("/account/security")).url()).toMatch(
    /\/login$/,
  );
  await page.getByLabel("Authenticator code").fill(authenticatorCode(uri!));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.goto("/account/security");
  await expect(page.getByRole("status")).toContainText(
    "enabled for your account",
  );
});
