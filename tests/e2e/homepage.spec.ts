import { test, expect } from "@playwright/test";

test("feature previews support pointer and keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  const tour = page.getByRole("tablist", { name: "Explore platform features" });
  await expect(
    tour.getByRole("tab", { name: "Portfolio", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await tour.getByRole("tab", { name: "Rent", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Every payment has its place.",
  );
  await expect(page.getByRole("tabpanel")).toContainText("£250");
  await tour
    .getByRole("tab", { name: "Rent", exact: true })
    .press("ArrowRight");
  await expect(
    tour.getByRole("tab", { name: "Repairs", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Keep every repair moving.",
  );
  await expect(page.getByRole("tabpanel")).toContainText("Under review");
  await tour.getByRole("tab", { name: "Repairs", exact: true }).press("End");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Your paperwork, in order.",
  );
  await expect(page.getByRole("tabpanel")).toContainText(
    "Private to your organisation",
  );
  await tour.getByRole("tab", { name: "Documents", exact: true }).press("Home");
  await expect(
    tour.getByRole("tab", { name: "Portfolio", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "A home for every property.",
  );
});

test("repair illustration explains permitted tenant and private landlord views", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Internal note · landlord only")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Landlord view", exact: true })
    .click();
  await expect(page.getByText("Internal note · landlord only")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Landlord view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tenant view", exact: true }).click();
  await expect(page.getByText("Internal note · landlord only")).toHaveCount(0);
  await expect(
    page.getByText("Only permitted updates are shown to this tenant."),
  ).toBeVisible();
});

test("mobile navigation, FAQ and primary registration links work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Features", exact: true })
    .click();
  await expect(page).toHaveURL(/#features$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();
  await page
    .locator("summary")
    .filter({ hasText: "What can my tenants see?" })
    .click();
  await expect(
    page.getByText(
      /Landlord-created repairs are private by default, with separate controls/,
    ),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create your workspace" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Full name")).toBeVisible();
});

test("homepage adapts to narrow and wide screens and honours reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create your workspace" }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("h1")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    const cta = await page
      .getByRole("link", { name: "Create your workspace" })
      .first()
      .boundingBox();
    expect(cta!.x).toBeGreaterThanOrEqual(0);
    expect(cta!.x + cta!.width).toBeLessThanOrEqual(width);
    await expect(page.locator(".home-product-window")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("the marketing narrative remains available without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your workspace" }).first(),
  ).toHaveAttribute("href", "/register");
  await expect(page.getByText("A home for every property.")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "How does rent tracking work?" })
    .click();
  await expect(
    page.getByText(/Manual tracking works without a payment-provider account/),
  ).toBeVisible();
  await context.close();
});
