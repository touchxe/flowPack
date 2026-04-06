import { test, expect } from "@playwright/test";

test("capture page structure for comparison", async ({ page }) => {
  // Capture Mirr
  await page.goto("https://www.mirra.my/ko", { waitUntil: "networkidle" });
  const mirrStyles = await page.evaluate(() => {
    const body = document.body;
    const computed = window.getComputedStyle(body);
    return {
      fontFamily: computed.fontFamily,
      backgroundColor: computed.backgroundColor,
      sections: document.querySelectorAll("section").length,
      h1Text: document.querySelector("h1")?.textContent,
      h2Count: document.querySelectorAll("h2").length,
      buttonCount: document.querySelectorAll("button, a[href]").length,
    };
  });

  console.log("Mirr styles:", JSON.stringify(mirrStyles, null, 2));

  // Capture FlowPack
  await page.goto("http://localhost:3002", { waitUntil: "networkidle" });
  const flowpackStyles = await page.evaluate(() => {
    const body = document.body;
    const computed = window.getComputedStyle(body);
    return {
      fontFamily: computed.fontFamily,
      backgroundColor: computed.backgroundColor,
      sections: document.querySelectorAll("section").length,
      h1Text: document.querySelector("h1")?.textContent,
      h2Count: document.querySelectorAll("h2").length,
      buttonCount: document.querySelectorAll("button, a[href]").length,
    };
  });

  console.log("FlowPack styles:", JSON.stringify(flowpackStyles, null, 2));
});