const { chromium } = require("playwright")
const readline = require("node:readline/promises")

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  })

  const page = await browser.newPage()

  await page.goto("https://bubble.io", {
    waitUntil: "domcontentloaded",
  })

  console.log("\n1. Log in to Bubble if necessary.")
  console.log("2. Open your BookLeaf app editor.")
  console.log("3. Navigate to Data → App data → All Books → New entry.")
  console.log("4. Leave the New entry popup open.")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  await rl.question("\nPress ENTER when the popup is open...")

  const elements = await page
    .locator("input, textarea, select, button")
    .evaluateAll((nodes) =>
      nodes.map((el) => ({
        tag: el.tagName,
        type: el.type || "",
        placeholder: el.placeholder || "",
        ariaLabel: el.getAttribute("aria-label"),
        name: el.getAttribute("name"),
        text: el.innerText?.trim().slice(0, 80),
        value: el.value || "",
      }))
    )

  console.log("\n--- FORM ELEMENTS ---")
  console.log(JSON.stringify(elements, null, 2))

  await page.screenshot({
    path: "bubble-form-inspection.png",
    fullPage: true,
  })

  console.log("\nInspection complete. Browser remains open.")
  await rl.question("Press ENTER to close browser...")
  rl.close()

  await browser.close()
}

main().catch(console.error)
