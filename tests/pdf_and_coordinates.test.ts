import path from "path";

// Test 1: Batch ID regex validation
const BATCH_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

function testBatchId() {
  console.log("Running Batch ID validation tests...");
  if (!BATCH_ID_REGEX.test("0004")) throw new Error("0004 should be valid");
  if (!BATCH_ID_REGEX.test("0003")) throw new Error("0003 should be valid");
  if (!BATCH_ID_REGEX.test("batch-123_abc")) throw new Error("batch-123_abc should be valid");
  if (BATCH_ID_REGEX.test("../0004")) throw new Error("../0004 should be rejected");
  if (BATCH_ID_REGEX.test("..")) throw new Error(".. should be rejected");
  if (BATCH_ID_REGEX.test("0004/test")) throw new Error("slashes should be rejected");
  if (BATCH_ID_REGEX.test("0004\\test")) throw new Error("backslashes should be rejected");
  if (BATCH_ID_REGEX.test("")) throw new Error("empty string should be rejected");
  if (BATCH_ID_REGEX.test("a".repeat(65))) throw new Error("too long string should be rejected");
  console.log("✓ Batch ID validation tests passed.");
}

// Test 2: Path containment check
const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

function isPathInside(childPath: string, parentDir: string): boolean {
  const relative = path.relative(parentDir, path.resolve(childPath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function testPathContainment() {
  console.log("Running path containment tests...");
  const validBatch = path.resolve(UPLOADS_ROOT, "0004");
  const validFile = path.resolve(UPLOADS_ROOT, "0004", "Invoice.pdf");
  const invalidTraversal = path.resolve(UPLOADS_ROOT, "..", "secret.txt");
  const invalidRoot = path.resolve(process.cwd(), "package.json");

  if (!isPathInside(validBatch, UPLOADS_ROOT)) throw new Error("Valid batch dir should be inside");
  if (!isPathInside(validFile, UPLOADS_ROOT)) throw new Error("Valid file should be inside");
  if (isPathInside(invalidTraversal, UPLOADS_ROOT)) throw new Error("Traversal path must be rejected");
  if (isPathInside(invalidRoot, UPLOADS_ROOT)) throw new Error("Root file must be rejected");
  console.log("✓ Path containment tests passed.");
}

// Test 3: Coordinate Normalizer Logic
function normalizeBbox(
  rawCoord?: { xmin?: number; ymin?: number; xmax?: number; ymax?: number; page?: number },
  pageFallback?: number
) {
  if (!rawCoord || rawCoord.xmin === undefined || rawCoord.ymin === undefined) return undefined;
  const pageNum = rawCoord.page !== undefined ? Number(rawCoord.page) + 1 : (pageFallback ?? 1);
  const isPixel = (rawCoord.xmax ?? 0) > 100 || (rawCoord.ymax ?? 0) > 100;
  const isLandscape = isPixel && (rawCoord.xmax ?? 0) > 2480;
  const baseW = isPixel ? (isLandscape ? 3508 : 2480) : 100;
  const baseH = isPixel ? (isLandscape ? 2480 : 3508) : 100;

  const x = Math.max(0, Math.min(100, (rawCoord.xmin / baseW) * 100));
  const y = Math.max(0, Math.min(100, (rawCoord.ymin / baseH) * 100));
  const width = Math.max(1, Math.min(100, (((rawCoord.xmax ?? rawCoord.xmin) - rawCoord.xmin) / baseW) * 100));
  const height = Math.max(0.5, Math.min(100, (((rawCoord.ymax ?? rawCoord.ymin) - rawCoord.ymin) / baseH) * 100));

  return {
    page: pageNum,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  };
}

function testCoordinateNormalization() {
  console.log("Running coordinate normalization tests...");

  // Multi-page test: AK page 6 (Nanonets rawCoord.page = 5, pageFallback = 1)
  const akBbox = normalizeBbox({ xmin: 500, ymin: 1000, xmax: 1500, ymax: 1200, page: 5 }, 1);
  if (!akBbox || akBbox.page !== 6) {
    throw new Error(`AK page was ${akBbox?.page}, expected 6`);
  }
  console.log("  AK Page 6 box:", akBbox);

  // Fallback page test: no page in rawCoord, uses pageFallback = 2
  const pibBbox = normalizeBbox({ xmin: 200, ymin: 800, xmax: 1200, ymax: 900 }, 2);
  if (!pibBbox || pibBbox.page !== 2) {
    throw new Error(`PIB fallback page was ${pibBbox?.page}, expected 2`);
  }
  console.log("  PIB Page 2 fallback box:", pibBbox);

  // Landscape test: MS document with xmax = 3000 (> 2480)
  const msBbox = normalizeBbox({ xmin: 300, ymin: 400, xmax: 3000, ymax: 1800, page: 0 }, 1);
  if (!msBbox || msBbox.page !== 1) {
    throw new Error(`MS page was ${msBbox?.page}, expected 1`);
  }
  if (msBbox.width > 100 || msBbox.x > 100) {
    throw new Error(`MS landscape width/x exceeds 100%: ${JSON.stringify(msBbox)}`);
  }
  console.log("  MS Landscape box:", msBbox);

  // Portrait header test (xmax > ymax): field in upper header of A4 portrait
  // Invoice header No_Invoice where xmin=1200, ymin=100, xmax=1800, ymax=250 (xmax=1800 > ymax=250)
  // Must NOT be classified as landscape; must use baseW = 2480 and baseH = 3508.
  const headerBbox = normalizeBbox({ xmin: 1200, ymin: 100, xmax: 1800, ymax: 250, page: 0 }, 1);
  if (!headerBbox) {
    throw new Error("Header bbox should be defined");
  }
  const expectedHeaderX = Number(((1200 / 2480) * 100).toFixed(2)); // 48.39
  const expectedHeaderW = Number((((1800 - 1200) / 2480) * 100).toFixed(2)); // 24.19
  if (headerBbox.x !== expectedHeaderX) {
    throw new Error(`Header x was ${headerBbox.x}, expected ${expectedHeaderX} (portrait baseW=2480)`);
  }
  if (headerBbox.width !== expectedHeaderW) {
    throw new Error(`Header width was ${headerBbox.width}, expected ${expectedHeaderW} (portrait baseW=2480)`);
  }
  console.log("  Portrait header box (xmax > ymax correctly portrait):", headerBbox);

  // Verify consistency with footer field on same document (where ymax > xmax)
  const footerBbox = normalizeBbox({ xmin: 1200, ymin: 2500, xmax: 1800, ymax: 2800, page: 0 }, 1);
  if (!footerBbox) {
    throw new Error("Footer bbox should be defined");
  }
  if (footerBbox.x !== headerBbox.x) {
    throw new Error(`Discrepancy: footer x (${footerBbox.x}) != header x (${headerBbox.x}) for identical x bounds`);
  }
  if (footerBbox.width !== headerBbox.width) {
    throw new Error(`Discrepancy: footer width (${footerBbox.width}) != header width (${headerBbox.width}) for identical x bounds`);
  }
  console.log("  Portrait footer box (consistent with header):", footerBbox);

  console.log("✓ Coordinate normalization tests passed.");
}

function runAll() {
  testBatchId();
  testPathContainment();
  testCoordinateNormalization();
  console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
}

runAll();
