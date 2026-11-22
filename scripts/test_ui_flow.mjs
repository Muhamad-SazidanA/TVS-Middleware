import { BrowserHarness } from "../tests/browser/harness.mjs";
import http from "http";

async function loginUser(email, password = "password123") {
  const csrfRes = await new Promise((resolve, reject) => {
    http.get("http://localhost:3000/api/auth/csrf", (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ json: JSON.parse(data), cookie: res.headers["set-cookie"] }));
    });
  });

  const csrfToken = csrfRes.json.csrfToken;
  const postData = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect: "false",
  }).toString();

  const csrfCookies = (csrfRes.cookie || []).map((c) => c.split(";")[0]).join("; ");

  return new Promise((resolve, reject) => {
    const req = http.request("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Cookie: csrfCookies,
      },
    }, (res) => {
      const setCookies = res.headers["set-cookie"] || [];
      const sessionCookie = setCookies.find((c) => c.startsWith("authjs.session-token="));
      if (!sessionCookie) return reject(new Error("No session cookie"));
      const val = sessionCookie.split(";")[0].replace("authjs.session-token=", "");
      resolve(val);
    });
    req.write(postData);
    req.end();
  });
}

async function testUi() {
  console.log("Acquiring session token for Admin Approver...");
  const sessionToken = await loginUser("admin@docmatch.id", "password123");
  console.log("[OK] Session token acquired.");

  const harness = new BrowserHarness({ headless: true });
  await harness.launch();

  // Inject session cookie into Chrome
  await harness.send("Network.setCookie", {
    url: "http://localhost:3000",
    name: "authjs.session-token",
    value: sessionToken,
    path: "/",
    httpOnly: true,
  });
  console.log("[OK] Cookie injected via CDP.");

  // Navigate directly to /matching
  console.log("Navigating to http://localhost:3000/matching?batchId=0004...");
  await harness.navigate("http://localhost:3000/matching?batchId=0004");

  // Wait for matching modal to open
  await harness.waitForSelector("div.max-w-7xl, div.fixed.inset-0", 12000);
  await new Promise((r) => setTimeout(r, 2000));
  console.log("[OK] Matching detail modal opened.");

  // Take screenshot of MatchingDetailView
  const modalPath = "C:/Users/msazi/.gemini/antigravity/brain/3987a3fc-f8f2-4db1-92dc-d55dc615bb3d/matching_detail_field_only_verified.png";
  await harness.captureScreenshot(modalPath);
  console.log("[OK] Captured matching_detail_field_only_verified.png");

  // Verify that there is NO Table line items section inside the comparison panel
  const checkLineItems = await harness.evaluate(() => {
    const bodyText = document.body.innerText;
    const hasBarisBarang = bodyText.includes("Baris barang");
    const hasTableBadge = Array.from(document.querySelectorAll("span")).some(
      (s) => s.innerText.trim().toUpperCase() === "TABLE"
    );
    const fieldCards = document.querySelectorAll("div.border-slate-200, div.rounded-xl");
    return {
      hasBarisBarang,
      hasTableBadge,
      fieldCardCount: fieldCards.length,
      sampleTitle: document.querySelector("h3")?.innerText,
    };
  });

  console.log("Evaluation check:", checkLineItems);
  if (checkLineItems.hasBarisBarang || checkLineItems.hasTableBadge) {
    throw new Error("Table line items section still present in UI!");
  }
  console.log("[PASS] Field-only matching verified in UI: No table line-item section rendered!");

  await harness.close();
  console.log("=== UI VERIFICATION COMPLETED SUCCESSFULLY ===");
}

testUi().catch((err) => {
  console.error("UI Test Error:", err);
  process.exit(1);
});
