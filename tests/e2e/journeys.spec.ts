import "dotenv/config";
import { test, expect, type Page, type Browser } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
type Accounts = {
  accounts: { role: string; email: string; password: string }[];
  records: {
    privateRepairId: string;
    sharedRepairId: string;
    tenantRepairId: string;
    organisationId: string;
  };
};
let seed: Accounts;
test.beforeAll(async () => {
  seed = JSON.parse(await readFile(".dev-accounts.json", "utf8"));
});
async function login(page: Page, role: string) {
  const a = seed.accounts.find((a) => a.role === role)!;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/onboarding|\/app/);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
}
async function actor(browser: Browser, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, role);
  return { context, page };
}
test("public pages and mobile layout render without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /More clarity/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "Create your workspace" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.goto("/features");
  await expect(
    page.getByRole("heading", { name: "Your rental business, connected." }),
  ).toBeVisible();
});
test("register, verify email, create organisation and persist onboarding", async ({
  page,
}) => {
  const email = `journey-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Journey Landlord");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(`Test-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("verification link");
  const job = await db.backgroundJob.findFirstOrThrow({
    where: { type: "email", payload: { path: ["to"], equals: email } },
    orderBy: { createdAt: "desc" },
  });
  const text = (job.payload as { text: string }).text;
  const url = text.match(/https?:\/\/\S+/)![0];
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Your workspace starts here." }),
  ).toBeVisible();
  await page
    .getByLabel("Organisation / business name")
    .fill("Journey Organisation");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(
    page.getByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
});
test("private repair is hidden in the UI and direct requests; share and revoke access", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const tenant = await actor(browser, "Tenant");
  const other = await actor(browser, "OtherTenant");
  const id = seed.records.privateRepairId;
  await tenant.page.goto("/app/repairs");
  await expect(
    tenant.page.getByText("Private preventative roof inspection"),
  ).toHaveCount(0);
  expect((await tenant.page.request.get(`/api/repairs/${id}`)).status()).toBe(
    404,
  );
  await tenant.page.goto(`/app/repairs/${id}`);
  await expect(
    tenant.page.getByRole("heading", { name: "That record isn’t available." }),
  ).toBeVisible();
  await landlord.page.goto(`/app/repairs/${id}`);
  await landlord.page
    .getByRole("combobox", { name: "Access", exact: true })
    .selectOption("selected");
  await landlord.page.getByRole("checkbox", { name: "Jamie Parker" }).check();
  await landlord.page
    .getByRole("button", { name: "Save tenant access" })
    .click();
  await expect
    .poll(async () =>
      (await tenant.page.request.get(`/api/repairs/${id}`)).status(),
    )
    .toBe(200);
  const visible = await (
    await tenant.page.request.get(`/api/repairs/${id}`)
  ).json();
  expect(visible).not.toHaveProperty("internalNotes");
  expect(visible).not.toHaveProperty("expenses");
  expect((await other.page.request.get(`/api/repairs/${id}`)).status()).toBe(
    404,
  );
  await tenant.page.goto(`/app/repairs/${id}`);
  await expect(
    tenant.page.getByRole("heading", {
      name: "Private preventative roof inspection",
    }),
  ).toBeVisible();
  await expect(
    tenant.page.getByText("Private cost planning and supplier notes."),
  ).toHaveCount(0);
  await landlord.page
    .getByRole("combobox", { name: "Access", exact: true })
    .selectOption("private");
  await landlord.page
    .getByRole("button", { name: "Save tenant access" })
    .click();
  await expect
    .poll(async () =>
      (await tenant.page.request.get(`/api/repairs/${id}`)).status(),
    )
    .toBe(404);
  await tenant.page.goto("/app/repairs");
  await expect(
    tenant.page.getByText("Private preventative roof inspection"),
  ).toHaveCount(0);
  await Promise.all([
    landlord.context.close(),
    tenant.context.close(),
    other.context.close(),
  ]);
});
test("tenant repair report, public conversation and landlord resolution", async ({
  browser,
}) => {
  const tenant = await actor(browser, "Tenant");
  const landlord = await actor(browser, "Landlord");
  const title = `Leaking basin ${randomUUID().slice(0, 5)}`;
  await tenant.page.goto("/app/repairs?new=1");
  await tenant.page.getByLabel("Short title").fill(title);
  await tenant.page
    .getByLabel("Describe the problem")
    .fill("There is a leak beneath the basin when water is running.");
  await tenant.page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Plumbing");
  await tenant.page
    .locator("input[name=attachments]")
    .setInputFiles({
      name: "repair-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ9kAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await tenant.page.getByRole("button", { name: "Submit repair" }).click();
  await tenant.page.waitForURL(/\/app\/repairs\/.+/);
  const id = tenant.page.url().split("/").pop()!;
  await expect(tenant.page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    tenant.page.getByRole("link", { name: /repair-photo.png/ }),
  ).toBeVisible();
  await tenant.page
    .getByLabel("Repair message")
    .fill("A photo will follow shortly.");
  await tenant.page.getByRole("button", { name: "Send message" }).click();
  await expect(
    tenant.page.getByText("A photo will follow shortly."),
  ).toBeVisible();
  await landlord.page.goto(`/app/repairs/${id}`);
  await landlord.page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("resolved");
  await landlord.page
    .getByLabel("Tenant-visible completion summary")
    .fill("The fitting has been repaired and checked.");
  await landlord.page
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await tenant.page.request.get(`/api/repairs/${id}`);
      return (await r.json()).status;
    })
    .toBe("resolved");
  await tenant.page.reload();
  await expect(
    tenant.page.getByText(/The fitting has been repaired and checked/),
  ).toBeVisible();
  await tenant.context.close();
  await landlord.context.close();
});
test("landlord adds a property, tenant, tenancy, payment and tenant invitation", async ({
  page,
  browser,
}) => {
  await login(page, "Landlord");
  const suffix = randomUUID().slice(0, 5);
  await page.goto("/app/properties?new=1");
  await page.getByLabel("Property name").fill(`Journey House ${suffix}`);
  await page.getByLabel("Address").fill("25 Journey Road, Bristol");
  await page.getByLabel("Postcode").fill("BS1 2XY");
  await page
    .getByRole("button", { name: "Save property", exact: true })
    .click();
  await page.waitForURL(/\/app\/properties\/.+/);
  const propertyId = page.url().split("/").pop()!;
  await page.goto("/app/tenants?new=1");
  const email = `invited-${suffix}@example.test`;
  await page.getByLabel("Full name").fill(`Invited Tenant ${suffix}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Save tenant", exact: true }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("/app/tenancies?new=1");
  await page
    .getByRole("combobox", { name: "Property", exact: true })
    .selectOption(propertyId);
  await page
    .getByRole("checkbox", { name: `Invited Tenant ${suffix}`, exact: true })
    .check();
  await page.getByLabel("Tenancy reference").fill(`JOURNEY-${suffix}`);
  await page
    .getByLabel("Start date")
    .fill(new Date().toISOString().slice(0, 7) + "-01");
  await page.getByLabel("Rent amount").fill("1200");
  await page.getByRole("button", { name: "Save tenancy", exact: true }).click();
  await expect(
    page.getByText(`JOURNEY-${suffix}`, { exact: true }),
  ).toBeVisible();
  await page.goto("/app/tenants");
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Invite", exact: true }).click();
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const job = await db.backgroundJob.findFirstOrThrow({
    where: { type: "email", payload: { path: ["to"], equals: email } },
    orderBy: { createdAt: "desc" },
  });
  expect((job.payload as { text: string }).text).toContain("/invite?token=");
  await page.goto("/app/payments?new=1");
  const tenancy = await db.tenancy.findUniqueOrThrow({
    where: {
      organisationId_reference: {
        organisationId: seed.records.organisationId,
        reference: `JOURNEY-${suffix}`,
      },
    },
  });
  await page
    .getByRole("combobox", { name: "Tenancy", exact: true })
    .selectOption(tenancy.id);
  await page.getByLabel("Amount received").fill("400");
  await page
    .getByLabel("Payment date")
    .fill(new Date().toISOString().slice(0, 10));
  await page
    .getByLabel("Bank / receipt reference")
    .fill(`JOURNEY-PAY-${suffix}`);
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.getByText(`JOURNEY-PAY-${suffix}`)).toBeVisible();
  const obligation = await db.rentObligation.findFirstOrThrow({
    where: { tenancyId: tenancy.id },
    include: { allocations: true },
    orderBy: { dueDate: "asc" },
  });
  expect(
    obligation.amountPence -
      obligation.allocations.reduce((s, a) => s + a.amountPence, 0),
  ).toBe(80000);
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  const inviteURL = (job.payload as { text: string }).text.match(
    /https?:\/\/\S+/,
  )![0];
  await invited.goto(inviteURL);
  await invited
    .getByRole("link", { name: "Create account", exact: true })
    .click();
  await invited.getByLabel("Full name").fill(`Invited Tenant ${suffix}`);
  await invited.getByLabel("Email address").fill(email);
  await invited
    .getByLabel("Password", { exact: true })
    .fill(`Test-${randomUUID()}`);
  await invited.getByRole("checkbox").check();
  await invited
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(invited.getByRole("status")).toContainText("verification link");
  const verification = await db.backgroundJob.findFirstOrThrow({
    where: { type: "email", payload: { path: ["to"], equals: email } },
    orderBy: { createdAt: "desc" },
  });
  await invited.goto(
    (verification.payload as { text: string }).text.match(/https?:\/\/\S+/)![0],
  );
  await invited.getByRole("button", { name: "Accept invitation" }).click();
  await expect(invited.getByRole("heading", { name: /Good / })).toBeVisible();
  await invited.goto("/app/tenancies");
  await expect(
    invited.getByText(`JOURNEY-${suffix}`, { exact: true }),
  ).toBeVisible();
  await invitedContext.close();
});
test("tenant mobile navigation works and forbids landlord records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "Tenant");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "My tenancy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tenancies" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/workspace/payments", {
        headers: { Origin: "http://localhost:3000" },
        data: {
          tenancyId: "dev-tenancy-one",
          amountPence: 1,
          paidAt: "2026-10-01",
          reference: "forged",
          idempotencyKey: randomUUID(),
        },
      })
    ).status(),
  ).toBe(403);
});
test.afterAll(async () => {
  await db.$disconnect();
});
