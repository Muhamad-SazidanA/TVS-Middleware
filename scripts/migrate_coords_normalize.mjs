import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING COORDINATE NORMALIZATION MIGRATION ---\n');

  const allDetails = await prisma.detailBatch.findMany({
    where: {
      isi: {
        not: null,
      },
    },
    select: {
      id: true,
      batchId: true,
      fileType: true,
      isi: true,
    },
  });

  console.log(`Found ${allDetails.length} detail_batches rows with non-null isi.\n`);

  let updatedCount = 0;
  let alreadyNormalizedCount = 0;
  let noCoordsCount = 0;
  let parseErrorCount = 0;

  for (const row of allDetails) {
    if (!row.isi || !row.isi.trim()) {
      noCoordsCount++;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(row.isi);
    } catch (err) {
      console.warn(`[Row ID ${row.id}] JSON parse error:`, err.message);
      parseErrorCount++;
      continue;
    }

    const hasCoords = parsed.coordinates && Object.keys(parsed.coordinates).length > 0;
    const hasTableCoords = Array.isArray(parsed.tableCoordinates) && parsed.tableCoordinates.length > 0;

    if (!hasCoords && !hasTableCoords) {
      noCoordsCount++;
      continue;
    }

    const docCodeUpper = (row.fileType || '').toUpperCase().trim();
    let hasExceedPortraitX = false;

    // Check if any coordinates exceed portrait width (2480px)
    if (parsed.coordinates && typeof parsed.coordinates === 'object') {
      for (const c of Object.values(parsed.coordinates)) {
        if (c && typeof c === 'object' && ((c.xmax ?? 0) > 2480 || (c.xmin ?? 0) > 2480)) {
          hasExceedPortraitX = true;
          break;
        }
      }
    }

    if (!hasExceedPortraitX && Array.isArray(parsed.tableCoordinates)) {
      for (const tableRow of parsed.tableCoordinates) {
        if (!tableRow || typeof tableRow !== 'object') continue;
        for (const c of Object.values(tableRow)) {
          if (c && typeof c === 'object' && ((c.xmax ?? 0) > 2480 || (c.xmin ?? 0) > 2480)) {
            hasExceedPortraitX = true;
            break;
          }
        }
        if (hasExceedPortraitX) break;
      }
    }

    const isLandscape = Boolean(
      hasExceedPortraitX ||
      docCodeUpper === 'WL' ||
      docCodeUpper === 'MS' ||
      docCodeUpper.startsWith('WL') ||
      docCodeUpper.startsWith('MS') ||
      parsed.isLandscape
    );

    const pageW = isLandscape ? 3508 : 2480;
    const pageH = isLandscape ? 2480 : 3508;

    function normalizeCoord(coord) {
      if (!coord || typeof coord !== 'object') return { coord, changed: false };

      let xmin = Number(coord.xmin ?? 0);
      let ymin = Number(coord.ymin ?? 0);
      let xmax = Number(coord.xmax ?? 0);
      let ymax = Number(coord.ymax ?? 0);
      let page = Number(coord.page ?? 0);

      // If already normalized (xmax <= 1 and ymax <= 1), do not touch
      if (xmax <= 1 && ymax <= 1) {
        return { coord, changed: false };
      }

      // If xmin=0 AND ymin=0 AND xmax=0 AND ymax=0: skip normalization, store as-is
      if (xmin === 0 && ymin === 0 && xmax === 0 && ymax === 0) {
        return { coord: { xmin: 0, ymin: 0, xmax: 0, ymax: 0, page }, changed: false };
      }

      // Cumulative Y bug fix (B1)
      if (ymax > pageH * (page + 1) || ymin > pageH) {
        const actualPage = Math.floor(ymin / pageH);
        ymin = ymin - actualPage * pageH;
        ymax = ymax - actualPage * pageH;
        page = actualPage;
      }

      // Normalize to 0-1 ratios (B2)
      // Use 4 decimal places for sub-pixel precision while safely fitting in MySQL TEXT column
      return {
        coord: {
          xmin: Number((xmin / pageW).toFixed(4)),
          ymin: Number((ymin / pageH).toFixed(4)),
          xmax: Number((xmax / pageW).toFixed(4)),
          ymax: Number((ymax / pageH).toFixed(4)),
          page,
        },
        changed: true,
      };
    }

    let rowChanged = false;

    // Normalize field coordinates
    if (parsed.coordinates && typeof parsed.coordinates === 'object') {
      for (const [k, v] of Object.entries(parsed.coordinates)) {
        const res = normalizeCoord(v);
        if (res.changed) {
          parsed.coordinates[k] = res.coord;
          rowChanged = true;
        }
      }
    }

    // Normalize tableCoordinates
    if (Array.isArray(parsed.tableCoordinates)) {
      for (let r = 0; r < parsed.tableCoordinates.length; r++) {
        const tableRow = parsed.tableCoordinates[r];
        if (!tableRow || typeof tableRow !== 'object') continue;
        for (const [k, v] of Object.entries(tableRow)) {
          const res = normalizeCoord(v);
          if (res.changed) {
            tableRow[k] = res.coord;
            rowChanged = true;
          }
        }
      }
    }

    if (rowChanged) {
      await prisma.detailBatch.update({
        where: { id: row.id },
        data: {
          isi: JSON.stringify(parsed),
        },
      });
      console.log(`[Row ID ${row.id} - ${row.fileType}] Normalized coordinates (isLandscape: ${isLandscape})`);
      updatedCount++;
    } else {
      alreadyNormalizedCount++;
    }
  }

  console.log('\n--- MIGRATION SUMMARY ---');
  console.log(`Total inspected:        ${allDetails.length}`);
  console.log(`Rows updated:           ${updatedCount}`);
  console.log(`Already normalized:     ${alreadyNormalizedCount}`);
  console.log(`No coordinates found:   ${noCoordsCount}`);
  console.log(`Parse errors:           ${parseErrorCount}`);
  console.log('------------------------\n');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
