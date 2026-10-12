import "dotenv/config";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { db } from "../../src/server/db";
type Seed = {
  accounts: { role: string; email: string; password: string }[];
  records: { organisationId: string; privateRepairId: string };
};
let seed: Seed;
test.beforeAll(async () => {
  seed = JSON.parse(await readFile(".dev-accounts.json", "utf8"));
});
async function actor(browser: Browser, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = seed.accounts.find((a) => a.role === role)!;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/onboarding|\/app/);
  return { context, page };
}
async function create(page: Page, resource: string, data: unknown) {
  const result = await page.request.post(`/api/workspace/${resource}`, {
    headers: { origin: "http://localhost:3000" },
    data,
  });
  expect(result.ok()).toBe(true);
  return result.json() as Promise<{ id: string; reference?: string }>;
}
async function seedProperty() {
  return db.repair.findUniqueOrThrow({
    where: { id: seed.records.privateRepairId },
    select: { propertyId: true },
  });
}
async function seededTenant() {
  return db.tenant.findUniqueOrThrow({
    where: {
      organisationId_email: {
        organisationId: seed.records.organisationId,
        email: seed.accounts.find((a) => a.role === "Tenant")!.email,
      },
    },
    select: { id: true },
  });
}
async function withoutOperations(run: () => Promise<void>) {
  const subscription = await db.subscription.findUniqueOrThrow({
    where: { organisationId: seed.records.organisationId },
    include: { plan: true },
  });
  await db.subscriptionPlan.update({
    where: { id: subscription.planId },
    data: {
      features: subscription.plan.features.filter((f) => f !== "operations"),
    },
  });
  try {
    await run();
  } finally {
    await db.subscriptionPlan.update({
      where: { id: subscription.planId },
      data: { features: subscription.plan.features },
    });
  }
}

test("property records, unit edits and archive/restore persist without leaking financial information", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const suffix = randomUUID().slice(0, 8);
  const portfolio = await create(landlord.page, "portfolios", {
    name: `Portfolio ${suffix}`,
  });
  const owner = await create(landlord.page, "owners", {
    name: `Owner ${suffix}`,
  });
  const property = await create(landlord.page, "properties", {
    name: `Operations home ${suffix}`,
    address: "7 Operations Road, Bristol",
    postcode: "BS1 1AA",
    type: "HMO",
  });
  const room = await create(landlord.page, "units", {
    propertyId: property.id,
    name: "Flexible room",
  });
  await landlord.page.goto(`/app/properties/${property.id}`);
  await landlord.page
    .getByRole("button", { name: "Edit Flexible room", exact: true })
    .click();
  await landlord.page
    .getByLabel("Unit name", { exact: true })
    .fill("Studio room");
  await landlord.page
    .getByRole("button", { name: "Save unit", exact: true })
    .click();
  await expect(
    landlord.page.getByRole("button", {
      name: "Archive Studio room",
      exact: true,
    }),
  ).toBeVisible();
  landlord.page.once("dialog", (dialog) => dialog.accept());
  await landlord.page
    .getByRole("button", { name: "Archive Studio room", exact: true })
    .click();
  await expect(
    landlord.page.getByRole("button", {
      name: "Restore Studio room",
      exact: true,
    }),
  ).toBeVisible();
  await landlord.page
    .getByRole("button", { name: "Restore Studio room", exact: true })
    .click();
  await expect(
    landlord.page.getByRole("button", {
      name: "Archive Studio room",
      exact: true,
    }),
  ).toBeVisible();
  await landlord.page
    .getByRole("combobox", { name: "Portfolio", exact: true })
    .selectOption(portfolio.id);
  await landlord.page
    .getByRole("combobox", { name: "Owning entity", exact: true })
    .selectOption(owner.id);
  await landlord.page
    .getByLabel("Local authority", { exact: true })
    .fill("Bristol");
  await landlord.page
    .getByLabel("Mortgage balance", { exact: true })
    .fill("125000.35");
  await landlord.page
    .getByLabel("Mortgage reference", { exact: true })
    .fill(`PRIVATE-MORTGAGE-${suffix}`);
  await landlord.page
    .getByRole("button", { name: "Save property records" })
    .click();
  await expect(
    landlord.page.getByText("Property records saved.", { exact: true }),
  ).toBeVisible();
  await landlord.page.reload();
  await expect(
    landlord.page.getByLabel("Mortgage balance", { exact: true }),
  ).toHaveValue("125000.35");
  const tenantId = (await seededTenant()).id;
  await create(landlord.page, "tenancies", {
    propertyId: property.id,
    unitId: room.id,
    tenantIds: [tenantId],
    reference: `OPS-${suffix}`,
    startDate: new Date().toISOString().slice(0, 10),
    rentPence: 80000,
  });
  landlord.page.once("dialog", (dialog) => dialog.accept());
  await landlord.page
    .getByRole("button", { name: "Archive Studio room", exact: true })
    .click();
  await expect(
    landlord.page
      .getByRole("alert")
      .filter({ hasText: "End active tenancies" }),
  ).toContainText("End active tenancies");
  const tenant = await actor(browser, "Tenant");
  await tenant.page.goto(`/app/properties/${property.id}`);
  await expect(
    tenant.page.getByLabel("Mortgage reference", { exact: true }),
  ).toHaveCount(0);
  expect(
    await (
      await tenant.page.request.get(`/app/properties/${property.id}`)
    ).text(),
  ).not.toContain(`PRIVATE-MORTGAGE-${suffix}`);
  await landlord.page.setViewportSize({ width: 390, height: 844 });
  expect(
    await landlord.page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await landlord.context.close();
  await tenant.context.close();
});

test("shared repair estimates stay private while completion feedback and landlord responses work", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const tenant = await actor(browser, "Tenant");
  const other = await actor(browser, "OtherTenant");
  const propertyId = (await seedProperty()).propertyId;
  const repair = await create(landlord.page, "repairs", {
    propertyId,
    title: `Operations repair ${randomUUID().slice(0, 8)}`,
    description: "A leaking sink trap needs replacing and testing.",
    category: "Plumbing",
    estimatedCostPence: 25000,
  });
  expect(
    (await tenant.page.request.get(`/api/repairs/${repair.id}`)).status(),
  ).toBe(404);
  await landlord.page.goto(`/app/repairs/${repair.id}`);
  await landlord.page
    .getByLabel("Estimated repair cost", { exact: true })
    .fill("350");
  await landlord.page
    .getByRole("button", { name: "Save estimate", exact: true })
    .click();
  await expect(
    landlord.page.getByText("Estimated cost: £350.00", { exact: true }),
  ).toBeVisible();
  await landlord.page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("resolved");
  await landlord.page
    .getByLabel("Actual completion date")
    .fill(new Date().toISOString().slice(0, 10));
  await landlord.page
    .getByLabel("Tenant-visible completion summary")
    .fill("The sink trap has been replaced and tested.");
  await landlord.page
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await landlord.page
    .getByRole("combobox", { name: "Access", exact: true })
    .selectOption("selected");
  const tenantId = (await seededTenant()).id;
  await landlord.page
    .locator(`input[name="tenantIds"][value="${tenantId}"]`)
    .check();
  await landlord.page
    .getByRole("button", { name: "Save tenant access", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await tenant.page.request.get(`/api/repairs/${repair.id}`)).status(),
    )
    .toBe(200);
  await tenant.page.goto(`/app/repairs/${repair.id}`);
  await expect(
    tenant.page.getByText(/The sink trap has been replaced and tested/),
  ).toBeVisible();
  await expect(
    tenant.page.getByLabel("Estimated repair cost", { exact: true }),
  ).toHaveCount(0);
  const data = await (
    await tenant.page.request.get(`/api/repairs/${repair.id}`)
  ).json();
  expect(data).not.toHaveProperty("estimatedCostPence");
  await tenant.page
    .getByRole("combobox", { name: "Repair satisfaction", exact: true })
    .selectOption("5");
  await tenant.page
    .getByLabel("Repair feedback", { exact: true })
    .fill("The repair was completed with clear communication.");
  await tenant.page
    .getByRole("button", { name: "Submit repair feedback" })
    .click();
  await expect(tenant.page.getByRole("status")).toContainText(
    "repair feedback has been submitted",
  );
  await landlord.page.goto(
    `/app/feedback?q=${encodeURIComponent(repair.reference!)}`,
  );
  await landlord.page
    .getByRole("button", { name: "View", exact: true })
    .click();
  await landlord.page
    .getByLabel("Landlord response", { exact: true })
    .fill("Thank you. We have recorded your feedback.");
  await landlord.page
    .getByRole("button", { name: "Send feedback response" })
    .click();
  await expect(landlord.page.getByRole("dialog")).toHaveCount(0);
  await tenant.page.goto(
    `/app/feedback?q=${encodeURIComponent(repair.reference!)}`,
  );
  await tenant.page.getByRole("button", { name: "View", exact: true }).click();
  await expect(
    tenant.page.getByText("Thank you. We have recorded your feedback.", {
      exact: true,
    }),
  ).toBeVisible();
  const hidden = await other.page.request.get(
    `/api/workspace/feedback?q=${encodeURIComponent(repair.reference!)}`,
  );
  expect((await hidden.json()).rows).toHaveLength(0);
  await withoutOperations(async () => {
    await tenant.page.goto(`/app/repairs/${repair.id}`);
    await expect(
      tenant.page.getByRole("heading", {
        name: "How was your repair handled?",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      tenant.page.getByRole("button", { name: "Submit repair feedback" }),
    ).toHaveCount(0);
  });
  await landlord.context.close();
  await tenant.context.close();
  await other.context.close();
});

test("tenant preferences persist separately from email settings and only owners configure safety guidance", async ({
  browser,
}) => {
  const tenant = await actor(browser, "Tenant");
  const landlord = await actor(browser, "Landlord");
  await tenant.page.goto("/app/settings");
  await tenant.page
    .getByLabel("Telephone", { exact: true })
    .fill("07700 900123");
  await tenant.page
    .getByLabel("Preferred contact method")
    .selectOption("portal");
  await tenant.page
    .getByLabel("Accessibility or communication needs")
    .fill("Please send written updates.");
  await tenant.page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    tenant.page.getByText("Settings saved.", { exact: true }),
  ).toBeVisible();
  await tenant.page
    .getByRole("checkbox", { name: "Email me about routine portal updates" })
    .uncheck();
  await tenant.page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    tenant.page.getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  await tenant.page.reload();
  await expect(
    tenant.page.getByLabel("Telephone", { exact: true }),
  ).toHaveValue("07700 900123");
  await expect(
    tenant.page.getByLabel("Accessibility or communication needs"),
  ).toHaveValue("Please send written updates.");
  await expect(
    tenant.page.getByRole("button", { name: "Save repair safety & reminders" }),
  ).toHaveCount(0);
  expect(
    (
      await tenant.page.request.patch("/api/settings", {
        headers: { origin: "http://localhost:3000" },
        data: { organisationSettings: { emergencyContact: "spoof" } },
      })
    ).status(),
  ).toBe(403);
  await landlord.page.goto("/app/settings");
  await landlord.page
    .getByLabel("Landlord emergency contact", { exact: true })
    .fill("07700 900111");
  await landlord.page
    .getByLabel("Property repair safety guidance")
    .fill("Use the agreed urgent contact for repairs.");
  await landlord.page
    .getByRole("button", { name: "Save repair safety & reminders" })
    .click();
  await expect(
    landlord.page.getByText("Repair safety and reminders saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await tenant.page.goto("/app/repairs?new=1");
  await expect(tenant.page.getByText(/07700 900111/)).toBeVisible();
  await expect(
    tenant.page.getByText("Use the agreed urgent contact for repairs.", {
      exact: true,
    }),
  ).toBeVisible();
  await landlord.context.close();
  await tenant.context.close();
});

test("documents support expiry editing and live permission checks for secure preview links", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const tenant = await actor(browser, "Tenant");
  const propertyId = (await seedProperty()).propertyId;
  const tenantId = (await seededTenant()).id;
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Private document test evidence");
  const name = `expiry-${randomUUID()}.pdf`;
  const uploaded = await landlord.page.request.post("/api/documents", {
    headers: { origin: "http://localhost:3000" },
    multipart: {
      file: {
        name,
        mimeType: "application/pdf",
        buffer: Buffer.from(await pdf.save()),
      },
      propertyId,
      category: "Certificate",
      tenantIds: JSON.stringify([tenantId]),
    },
  });
  expect(uploaded.ok()).toBe(true);
  const document = (await uploaded.json()) as { id: string };
  await landlord.page.goto(`/app/documents?q=${encodeURIComponent(name)}`);
  await expect(
    landlord.page.getByRole("link", { name: `Preview ${name}`, exact: true }),
  ).toHaveAttribute("href", `/api/documents/${document.id}?preview=1`);
  await landlord.page
    .getByRole("button", { name: "Expiry", exact: true })
    .click();
  await landlord.page
    .getByRole("dialog")
    .locator('input[name="expiresAt"]')
    .fill("2027-01-10");
  await landlord.page
    .getByRole("button", { name: "Save document expiry" })
    .click();
  await expect(landlord.page.getByRole("dialog")).toHaveCount(0);
  await expect(
    landlord.page.getByRole("cell", { name: "10 Jan 2027", exact: true }),
  ).toBeVisible();
  await tenant.page.goto(`/app/documents?q=${encodeURIComponent(name)}`);
  await expect(
    tenant.page.getByRole("link", { name: `Preview ${name}`, exact: true }),
  ).toBeVisible();
  const preview = await tenant.page.request.get(
    `/api/documents/${document.id}?preview=1`,
  );
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-disposition"]).toMatch(/^inline;/);
  await landlord.page
    .getByRole("button", { name: "Change document sharing" })
    .click();
  await landlord.page
    .locator(`input[name="tenantIds"][value="${tenantId}"]`)
    .uncheck();
  await landlord.page
    .getByRole("button", { name: "Save access", exact: true })
    .click();
  await expect(landlord.page.getByRole("dialog")).toHaveCount(0);
  expect(
    (
      await tenant.page.request.get(`/api/documents/${document.id}?preview=1`)
    ).status(),
  ).toBe(404);
  await landlord.context.close();
  await tenant.context.close();
});

test("tenant payment receipts print cleanly and reject another tenant's direct request", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const tenant = await actor(browser, "Tenant");
  const other = await actor(browser, "OtherTenant");
  const person = await seededTenant();
  const participant = await db.tenancyParticipant.findFirstOrThrow({
    where: { tenantId: person.id, tenancyId: "dev-tenancy-one" },
    select: { tenancyId: true },
  });
  const payment = await create(landlord.page, "payments", {
    tenancyId: participant.tenancyId,
    amountPence: 175000,
    paidAt: new Date().toISOString().slice(0, 10),
    method: "bank transfer",
    reference: `Receipt-${randomUUID().slice(0, 8)}`,
    idempotencyKey: randomUUID(),
  });
  await tenant.page.goto(`/app/payments/${payment.id}/receipt`);
  await expect(
    tenant.page.getByRole("heading", { name: "Payment receipt", exact: true }),
  ).toBeVisible();
  await expect(tenant.page.locator(".payment-receipt .stat-value")).toHaveText(
    "£1,750.00",
  );
  await tenant.page.evaluate(() => {
    Object.defineProperty(window, "print", {
      value: () => {
        document.documentElement.dataset.printRequested = "true";
      },
    });
  });
  await tenant.page.getByRole("button", { name: "Print / save PDF" }).click();
  expect(
    await tenant.page.evaluate(
      () => document.documentElement.dataset.printRequested,
    ),
  ).toBe("true");
  await tenant.page.emulateMedia({ media: "print" });
  await expect(tenant.page.locator(".sidebar")).toBeHidden();
  await expect(tenant.page.locator(".payment-receipt")).toBeVisible();
  expect(
    (
      await other.page.request.get(`/api/payments/${payment.id}/receipt`)
    ).status(),
  ).toBe(404);
  await other.page.goto(`/app/payments/${payment.id}/receipt`);
  await expect(
    other.page.getByRole("heading", { name: "That record isn’t available." }),
  ).toBeVisible();
  await expect(other.page.locator(".payment-receipt")).toHaveCount(0);
  await landlord.context.close();
  await tenant.context.close();
  await other.context.close();
});

test("joint tenants can respond privately to deposit proposals and must review changed proposals", async ({
  browser,
}) => {
  const landlord = await actor(browser, "Landlord");
  const tenant = await actor(browser, "Tenant");
  const other = await actor(browser, "OtherTenant");
  const suffix = randomUUID().slice(0, 8);
  const property = await create(landlord.page, "properties", {
    name: `Deposit home ${suffix}`,
    address: "10 Operations Road",
    postcode: "BS1 1AD",
    type: "house",
  });
  const firstTenant = await seededTenant();
  const secondTenant = await db.tenant.findUniqueOrThrow({
    where: {
      organisationId_email: {
        organisationId: seed.records.organisationId,
        email: seed.accounts.find((a) => a.role === "OtherTenant")!.email,
      },
    },
    select: { id: true },
  });
  const tenancy = await create(landlord.page, "tenancies", {
    propertyId: property.id,
    tenantIds: [firstTenant.id, secondTenant.id],
    reference: `DEP-${suffix}`,
    startDate: new Date().toISOString().slice(0, 10),
    rentPence: 100000,
    depositPence: 100000,
  });
  const deposit = await db.deposit.findUniqueOrThrow({
    where: { tenancyId: tenancy.id },
  });
  const proposal = (amountPence: number) => ({
    scheme: "Manually recorded test scheme",
    reference: `DEP-${suffix}`,
    status: "scheme recorded",
    returnedPence: 0,
    notes: `PRIVATE-DEPOSIT-NOTE-${suffix}`,
    deductions: [
      {
        description: "Proposed damage repair",
        amountPence,
        accepted: false,
        tenantResponse: "",
        documentIds: [],
      },
    ],
  });
  expect(
    (
      await landlord.page.request.patch(
        `/api/workspace/deposits/${deposit.id}`,
        { headers: { origin: "http://localhost:3000" }, data: proposal(5000) },
      )
    ).ok(),
  ).toBe(true);
  await tenant.page.goto(`/app/deposits?propertyId=${property.id}`);
  await tenant.page
    .getByRole("button", { name: "View proposal & responses" })
    .click();
  await expect(
    tenant.page.getByRole("heading", { name: "Current deduction proposal" }),
  ).toBeVisible();
  await tenant.page
    .getByLabel("Your position on this proposal")
    .selectOption("question");
  await tenant.page
    .getByLabel("Your deposit response")
    .fill("Please provide the evidence for this proposed deduction.");
  await tenant.page
    .getByRole("button", { name: "Send deposit response" })
    .click();
  await expect(
    tenant.page.getByText("Your deposit response has been recorded.", {
      exact: true,
    }),
  ).toBeVisible();
  const coTenantView = await other.page.request.get(
    `/api/deposits/${deposit.id}/responses`,
  );
  expect(coTenantView.status()).toBe(200);
  expect((await coTenantView.json()).responses).toHaveLength(0);
  expect(
    await (
      await tenant.page.request.get(`/api/deposits/${deposit.id}/responses`)
    ).text(),
  ).not.toContain(`PRIVATE-DEPOSIT-NOTE-${suffix}`);
  expect(
    (
      await landlord.page.request.patch(
        `/api/workspace/deposits/${deposit.id}`,
        { headers: { origin: "http://localhost:3000" }, data: proposal(6000) },
      )
    ).ok(),
  ).toBe(true);
  await tenant.page
    .getByLabel("Your deposit response")
    .fill("This response is based on the earlier proposal.");
  await tenant.page
    .getByRole("button", { name: "Send deposit response" })
    .click();
  await expect(
    tenant.page.getByRole("alert").filter({ hasText: "proposal has changed" }),
  ).toContainText("proposal has changed");
  await tenant.page
    .getByRole("button", { name: "Refresh proposal", exact: true })
    .click();
  await expect(tenant.page.getByText(/£60.00/)).toBeVisible();
  await tenant.page
    .getByLabel("Your deposit response")
    .fill("Please explain the new amount in this revised proposal.");
  await tenant.page
    .getByRole("button", { name: "Send deposit response" })
    .click();
  await expect(
    tenant.page.getByText("Your deposit response has been recorded.", {
      exact: true,
    }),
  ).toBeVisible();
  await landlord.page.goto(`/app/deposits?propertyId=${property.id}`);
  await landlord.page
    .getByRole("button", { name: "View proposal & responses" })
    .click();
  await expect(
    landlord.page.getByText(
      "Please explain the new amount in this revised proposal.",
      { exact: true },
    ),
  ).toBeVisible();
  const stored = await db.deposit.findUniqueOrThrow({
    where: { id: deposit.id },
  });
  expect(stored.returnedPence).toBe(0);
  expect(stored.deductions).toMatchObject([{ accepted: false }]);
  const evidence = await landlord.page.request.get(
    `/api/deposits/${deposit.id}/evidence`,
  );
  expect(evidence.status()).toBe(200);
  expect(
    (await PDFDocument.load(await evidence.body())).getPageCount(),
  ).toBeGreaterThan(0);
  let releasePost!: () => void;
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  let failHistoryRefresh = true;
  await tenant.page.route(
    `**/api/deposits/${deposit.id}/responses`,
    async (route) => {
      if (route.request().method() === "POST") await postGate;
      if (route.request().method() === "GET" && failHistoryRefresh) {
        failHistoryRefresh = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "History temporarily unavailable." }),
        });
      } else await route.continue();
    },
  );
  const responseField = tenant.page.getByLabel("Your deposit response");
  await responseField.fill(
    "This response must remain recorded if the history refresh fails.",
  );
  await tenant.page
    .getByRole("button", { name: "Send deposit response" })
    .click();
  try {
    await expect(responseField).toBeDisabled();
    await expect(
      tenant.page.getByRole("button", { name: "Send deposit response" }),
    ).toBeDisabled();
  } finally {
    releasePost();
  }
  await expect(
    tenant.page.getByText("Your deposit response has been recorded.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    tenant.page
      .getByRole("alert")
      .filter({ hasText: "History temporarily unavailable." }),
  ).toBeVisible();
  await expect(responseField).toHaveValue("");
  await responseField.fill(
    "A new response after the acknowledged submission uses a new key.",
  );
  await tenant.page
    .getByRole("button", { name: "Send deposit response" })
    .click();
  await expect(
    tenant.page.getByText(
      "A new response after the acknowledged submission uses a new key.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await db.depositResponse.count({
      where: {
        depositId: deposit.id,
        body: "This response must remain recorded if the history refresh fails.",
      },
    }),
  ).toBe(1);
  await tenant.page.unroute(`**/api/deposits/${deposit.id}/responses`);
  await withoutOperations(async () => {
    await tenant.page.goto(`/app/deposits?propertyId=${property.id}`);
    await tenant.page
      .getByRole("button", { name: "View proposal & responses" })
      .click();
    await expect(
      tenant.page.getByText(/Portal responses are unavailable/),
    ).toBeVisible();
    await expect(
      tenant.page.getByRole("button", { name: "Send deposit response" }),
    ).toHaveCount(0);
  });
  await landlord.context.close();
  await tenant.context.close();
  await other.context.close();
});
