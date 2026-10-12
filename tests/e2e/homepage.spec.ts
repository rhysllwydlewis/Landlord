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
  for (const width of [320, 390, 760, 761, 768, 1440]) {
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

test("mobile navigation closes across viewport and focus changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden();
  const features = page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Features", exact: true });
  await features.focus();
  await features.press("Escape");
  await expect(features).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.mouse.click(5, 600);
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await menu.getByRole("link", { name: "Help & support" }).focus();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
});

test("mobile navigation is usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pricing$/);
  await context.close();
});

test("high contrast mode retains the complete hero heading", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1 span")).toBeVisible();
  const fill = await page
    .locator("h1 span")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("-webkit-text-fill-color"),
    );
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");
  expect(fill).not.toBe("transparent");
});

test("every feature tab points to a persistent labelled panel", async ({
  page,
}) => {
  await page.goto("/");
  for (const tab of await page.getByRole("tab").all()) {
    const controls = await tab.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const panel = page.locator(`[id="${controls}"]`);
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAttribute(
      "aria-labelledby",
      (await tab.getAttribute("id"))!,
    );
  }
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
});

test("content stays usable when the browser lacks Web Animations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "animate", {
      value: undefined,
      configurable: true,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("tab", { name: "Portfolio", exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByRole("tab", { name: "Rent", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Every payment has its place.",
  );
  expect(errors).toEqual([]);
});

test("scroll motion follows preference changes and preserves focused controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      this.setAttribute("data-animated", "true");
      return animate.apply(this, args);
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tour = page.locator("#product-tour");
  await tour.scrollIntoViewIfNeeded();
  await expect(tour).not.toHaveAttribute("data-animated", "true");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(tour).toHaveAttribute("data-animated", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => tour.evaluate((el) => el.getAnimations().length))
    .toBe(0);
  const repair = page.locator(".home-repair-section");
  await repair.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(repair).toHaveAttribute("data-animated", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const finalSection = page.locator(".home-final-cta");
  await finalSection
    .getByRole("link", { name: "Create your workspace" })
    .focus();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(
    finalSection.getByRole("link", { name: "Create your workspace" }),
  ).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(finalSection).not.toHaveAttribute("data-animated", "true");
});
