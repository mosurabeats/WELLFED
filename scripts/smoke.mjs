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
