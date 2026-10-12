import { test, expect } from "@playwright/test";

test("secure forms prevent native GET submission before scripts attach", async ({
  page,
  browser,
}) => {
  let release!: () => void;
  const scripts = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**", async (route) => {
    if (route.request().resourceType() === "script") await scripts;
    await route.continue();
  });
  try {
    await page.goto("/login", { waitUntil: "commit" });
    const form = page.locator(".auth-card form");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("inert", "");
    await expect(form.locator("input[name=password]")).toBeDisabled();
    release();
    await expect(form).not.toHaveAttribute("inert", "");
    await expect(form.locator("input[name=password]")).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await skip.focus();
    await skip.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  } finally {
    release();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noScripts = await context.newPage();
    await noScripts.goto("/login");
    await expect(noScripts.locator(".auth-card form")).toHaveAttribute(
      "method",
      "post",
    );
    await expect(noScripts.locator(".auth-card form")).toHaveAttribute(
      "inert",
      "",
    );
    await expect(noScripts.getByRole("status")).toBeVisible();
    await expect(noScripts.getByRole("status")).toContainText(
      "JavaScript is required",
    );
  } finally {
    await context.close();
  }
});
