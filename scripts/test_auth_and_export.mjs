import http from "http";
import ExcelJS from "exceljs";

async function fetchHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          text: () => Promise.resolve(bodyBuffer.toString("utf-8")),
          json: () => Promise.resolve(JSON.parse(bodyBuffer.toString("utf-8"))),
          buffer: () => Promise.resolve(bodyBuffer),
        });
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function loginUser(email, password = "password123") {
  // 1. Get CSRF token
  const csrfRes = await fetchHttp("http://localhost:3000/api/auth/csrf");
  const csrfData = await csrfRes.json();
  const csrfCookie = csrfRes.headers["set-cookie"]?.map((c) => c.split(";")[0]).join("; ") || "";

  // 2. Post credentials
  const formParams = new URLSearchParams({
    csrfToken: csrfData.csrfToken,
    email,
    password,
    redirect: "false",
  }).toString();

  const loginRes = await fetchHttp("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(formParams),
      Cookie: csrfCookie,
    },
    body: formParams,
  });

  const sessionCookie = loginRes.headers["set-cookie"]?.map((c) => c.split(";")[0]).join("; ") || "";
  return sessionCookie;
}

async function runTests() {
  console.log("==================================================");
  console.log("   TESTING AUTHENTICATION, ALL DATA, & EXCEL      ");
  console.log("==================================================");

  // A. Test Middleware Protection without credentials
  console.log("\n[TEST 1] Testing Route Protection Middleware (Unauthenticated)...");
  const unauthApi = await fetchHttp("http://localhost:3000/api/batches?scope=all_data");
  console.log("   Unauthenticated API response code:", unauthApi.statusCode);
  if (unauthApi.statusCode === 401) {
    console.log("   [PASS] API route blocked with 401 Unauthorized!");
  } else {
    console.error("   [FAIL] Expected 401 for unauthenticated API, got:", unauthApi.statusCode);
    process.exit(1);
  }

  const unauthPage = await fetchHttp("http://localhost:3000/all-data");
  console.log("   Unauthenticated Page response code:", unauthPage.statusCode);
  if (unauthPage.statusCode === 307 || unauthPage.statusCode === 302) {
    console.log("   [PASS] Page route redirected to login:", unauthPage.headers.location);
  } else {
    console.error("   [FAIL] Expected 302/307 redirect, got:", unauthPage.statusCode);
    process.exit(1);
  }

  // B. Authenticate as Admin Approver
  console.log("\n[TEST 2] Logging in as Admin Approver (admin@docmatch.id)...");
  const adminCookie = await loginUser("admin@docmatch.id", "password123");
  if (!adminCookie || !adminCookie.includes("session-token")) {
    console.error("   [FAIL] Failed to obtain session token for admin!");
    process.exit(1);
  }
  console.log("   [PASS] Admin logged in successfully! Session cookie acquired.");

  // C. Test All Data API with Admin Session
  console.log("\n[TEST 3] Testing GET /api/batches?scope=all_data (Authenticated)...");
  const allDataRes = await fetchHttp("http://localhost:3000/api/batches?scope=all_data", {
    headers: { Cookie: adminCookie },
  });
  console.log("   Status:", allDataRes.statusCode);
  const allDataJson = await allDataRes.json();
  console.log("   Total Approved Batches:", allDataJson.batches?.length);
  const nonApproved = (allDataJson.batches || []).filter((b) => b.rawStatus !== "APPROVED");
  if (nonApproved.length > 0) {
    console.error("   [FAIL] Found non-approved batches in all_data:", nonApproved.map((b) => b.id));
    process.exit(1);
  }
  console.log("   Sample Approved Batch:", {
    id: allDataJson.batches[0]?.id,
    status: allDataJson.batches[0]?.rawStatus,
    createdBy: allDataJson.batches[0]?.createdBy?.name,
    approvedBy: allDataJson.batches[0]?.approvedBy?.name,
  });
  console.log("   [PASS] All Data query strictly returns APPROVED batches!");

  // D. Test Excel Export Mode 1 (Clean - 1 Sheet)
  console.log("\n[TEST 4] Testing GET /api/export/excel?scope=all_data&mode=clean ...");
  const exportCleanRes = await fetchHttp("http://localhost:3000/api/export/excel?scope=all_data&mode=clean", {
    headers: { Cookie: adminCookie },
  });
  console.log("   Status:", exportCleanRes.statusCode);
  console.log("   Content-Type:", exportCleanRes.headers["content-type"]);
  console.log("   Content-Disposition:", exportCleanRes.headers["content-disposition"]);
  const cleanBuf = await exportCleanRes.buffer();
  const cleanWorkbook = new ExcelJS.Workbook();
  await cleanWorkbook.xlsx.load(cleanBuf);
  console.log("   Sheet Count:", cleanWorkbook.worksheets.length);
  console.log("   Sheet Names:", cleanWorkbook.worksheets.map((s) => s.name));
  const sheet1 = cleanWorkbook.worksheets[0];
  console.log("   Sheet 1 Name:", sheet1?.name);
  console.log("   Sheet 1 Total Rows:", sheet1?.rowCount);
  console.log("   Header Columns Sample:", sheet1?.getRow(2).values.slice(1, 6));
  if (cleanWorkbook.worksheets.length > 1 && sheet1 && sheet1.rowCount > 2) {
    console.log("   [PASS] Multi-sheet structure generated: Sheet 1 Overview + Detail Sheets per batch!");
  } else {
    console.error("   [FAIL] Mode 1 validation failed!");
    process.exit(1);
  }

  // E. Test Excel Export Mode 2 (With Action Log - Multi-Sheet + Global Audit)
  console.log("\n[TEST 5] Testing GET /api/export/excel?scope=all_data&mode=with_action_log ...");
  const exportLogRes = await fetchHttp("http://localhost:3000/api/export/excel?scope=all_data&mode=with_action_log", {
    headers: { Cookie: adminCookie },
  });
  console.log("   Status:", exportLogRes.statusCode);
  const logBuf = await exportLogRes.buffer();
  const logWorkbook = new ExcelJS.Workbook();
  await logWorkbook.xlsx.load(logBuf);
  console.log("   Sheet Count:", logWorkbook.worksheets.length);
  console.log("   Sheet Names:", logWorkbook.worksheets.map((s) => s.name));
  const hasGlobalAudit = logWorkbook.worksheets.some((s) => s.name.includes("Log Action"));
  if (logWorkbook.worksheets.length > 2 && hasGlobalAudit) {
    console.log("   [PASS] Mode 2 generated multi-sheet with overview, batch detail sheets, and Global Action Log!");
  } else {
    console.error("   [FAIL] Mode 2 validation failed!");
    process.exit(1);
  }

  // F. Test User A Personal Workspace Scope
  console.log("\n[TEST 6] Logging in as User A (usera@docmatch.id) & Testing Personal Workspace Scope...");
  const userACookie = await loginUser("usera@docmatch.id", "password123");
  const userABatchesRes = await fetchHttp("http://localhost:3000/api/batches?scope=personal", {
    headers: { Cookie: userACookie },
  });
  const userABatchesJson = await userABatchesRes.json();
  console.log("   User A Batches Count:", userABatchesJson.batches?.length);
  const alienBatches = (userABatchesJson.batches || []).filter(
    (b) => b.createdBy && b.createdBy.email !== "usera@docmatch.id"
  );
  if (alienBatches.length > 0) {
    console.error("   [FAIL] User A received batches belonging to someone else:", alienBatches.map((b) => b.id));
    process.exit(1);
  }
  console.log("   User A Batches Sample IDs:", userABatchesJson.batches?.map((b) => b.id));
  console.log("   [PASS] Personal workspace isolation strictly respected for User A!");

  console.log("\n==================================================");
  console.log("   ALL 6 TEST SUITES PASSED FLAWLESSLY!          ");
  console.log("==================================================");
}

runTests().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
