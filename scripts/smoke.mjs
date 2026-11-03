// End-to-end smoke test against a running server (default http://localhost:3000).
// Usage: npm run build && npm start & node scripts/smoke.mjs [baseUrl] [screenshotDir]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"] });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const step = (s) => console.log(`• ${s}`);

await page.goto(BASE);
await page.getByText("Set up your household").waitFor();
await shot("01-welcome");

step("quick household setup: 2 adults, 2 kids");
await page.getByText("Set up your household").click();
await page.getByRole("button", { name: "More" }).nth(1).click(); // second child
await page.getByRole("button", { name: "Create household" }).click();
await page.getByText("Adult 1").first().waitFor();

step("give child 1 a peanut allergy");
await page.getByText("Child 1").first().click();
await page.getByRole("button", { name: "Peanut", exact: true }).click();
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Peanut allergy").waitFor();
await shot("02-household");

step("generate $90 / 5 days / lunch+dinner plan");
await page.goto(`${BASE}/plan`);
await page.getByRole("button", { name: /Generate a plan/ }).click();
const budget = page.getByLabel("Budget in dollars");
await budget.fill("90");
await page.getByRole("combobox").nth(0).selectOption("5");
await page.getByRole("button", { name: "Lunch", exact: true }).click();
await page.getByRole("button", { name: /Generate \d+ meals/ }).click();
await page.getByText("Estimated").first().waitFor();
await shot("03-plan");
const mealCount = await page.locator("main button:has-text('kcal')").count();
step(`plan shows ${mealCount} meals`);
if (mealCount !== 10) errors.push(`expected 10 meals, got ${mealCount}`);
const peanut = await page.locator("main").getByText("Peanut Noodles").count();
if (peanut) errors.push("peanut recipe planned for peanut-allergic child");

step("swap first meal");
const totalBefore = await page.locator("text=Estimated").first().locator("xpath=following-sibling::div").textContent();
await page.locator("main button:has-text('kcal')").first().click();
await page.getByText("Swap meal").waitFor();
await shot("04-swap");
await page.locator("[role=dialog] button:has-text('plan $')").first().click();
await page.waitForTimeout(400);
const totalAfter = await page.locator("text=Estimated").first().locator("xpath=following-sibling::div").textContent();
step(`total ${totalBefore} → ${totalAfter}`);

step("shopping list");
await page.goto(`${BASE}/groceries`);
await page.getByText("Shopping mode").waitFor();
await shot("05-list");
await page.getByRole("checkbox").first().click();
await page.locator('[role=checkbox][aria-checked="true"]').first().waitFor({ timeout: 5000 }).catch(() => errors.push("check-off failed"));

step("budget + deals tabs");
await page.goto(`${BASE}/groceries?tab=deals`);
await page.getByRole("button", { name: "Load demo deals" }).click();
await page.getByRole("button", { name: "Remove demo data" }).waitFor();
await page.goto(`${BASE}/groceries?tab=compare`);
await page.getByText("Cheapest single-store trip").waitFor();
await shot("06-compare");
await page.goto(`${BASE}/groceries?tab=budget`);
await page.getByText("Cost by meal").waitFor();
await shot("07-budget");

step("shopping mode");
await page.goto(`${BASE}/groceries/shop`);
await page.getByText("Shopping", { exact: true }).waitFor();
await shot("08-shop");

step("recipe detail");
await page.goto(`${BASE}/recipes`);
await page.getByText("Sheet-Pan Chicken Thighs").first().click();
await page.getByText("Nutrition Facts").waitFor();
await shot("09-recipe");

step("assistant (offline parser)");
await page.goto(`${BASE}/assistant`);
await page.getByText(/Replace Wednesday/).click();
await page.getByText(/Swapped|couldn't find|No safe/).first().waitFor({ timeout: 15000 });
await shot("10-assistant");

step("flyer import: add a store, paste text (offline parser)");
await page.goto(`${BASE}/household?tab=stores`);
await page.getByRole("button", { name: "Add store" }).click();
await page.getByRole("link", { name: "Import flyer" }).first().waitFor();
await page.getByRole("link", { name: "Import flyer" }).first().click();
await page.getByText("Step 1").waitFor();
const openLink = page.locator("[role=dialog] a[target=_blank]");
if (!(await openLink.getAttribute("href"))?.startsWith("https://www.hannaford.com")) errors.push("flyer link missing");
await page.getByRole("radio", { name: /Paste text/ }).click();
await page.locator("[role=dialog] textarea").fill("Boneless chicken thighs $1.99/lb with card\nBroccoli crowns $1.49 lb\nPaper towels 6 pk $5.99");
await page.getByRole("button", { name: "Read text" }).click();
await page.getByRole("button", { name: /Save 2 deals/ }).click();
await page.getByText(/Saved 2 deals/).waitFor();
await page.getByText(/2 deals through/).waitFor();

step("flyer import: two screenshot pages (AI response mocked), replaces last import");
await page.route("**/api/ai/flyer", async (route) => {
  const body = route.request().postDataJSON();
  if (!body.file?.data || body.file.mime !== "image/jpeg") return route.fulfill({ status: 400, json: { error: "bad upload" } });
  await route.fulfill({ json: { validFrom: null, validTo: null, items: [
    { productName: "Ground Turkey 93%", brand: null, price: 3.99, regularPrice: 5.49, packageQty: 1, packageUnit: "lb", ingredientId: "ground-turkey", loyaltyRequired: null, couponRequired: null, promoNotes: null },
    { productName: "Broccoli Crowns", brand: null, price: 1.29, regularPrice: null, packageQty: 1, packageUnit: "lb", ingredientId: "broccoli", loyaltyRequired: null, couponRequired: null, promoNotes: null },
  ] } });
});
await page.getByRole("button", { name: "Update" }).first().click();
await page.locator("[role=dialog] input[type=file]").setInputFiles(["public/icon-512.png", "public/icon-192.png"]);
await page.getByText("Page 2 ·").waitFor();
await page.getByRole("button", { name: /Read 2 pages/ }).click();
await page.getByText(/Replace 2 earlier flyer deals/).waitFor();
await page.getByRole("button", { name: /Save 2 deals/ }).click();
await page.getByText(/replaced 2 older/).waitFor();
await page.unroute("**/api/ai/flyer");
await shot("12-deals-after-flyer");

step("persistence after reload");
await page.goto(`${BASE}/plan`);
await page.reload();
await page.getByText("Estimated").first().waitFor();
const persisted = await page.locator("main button:has-text('kcal')").count();
if (persisted < 9) errors.push(`plan not persisted (${persisted} meals)`);

step("today dashboard");
await page.goto(BASE);
await page.getByText("This week's budget").waitFor();
await shot("11-today");

await browser.close();
if (errors.length) {
  console.error("FAILURES:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Smoke test passed.");
