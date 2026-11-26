import assert from "node:assert/strict";
import test from "node:test";
import {
  deduplicateCaseInsensitive,
  loadEquivalencySeedData,
  seedEquivalenciesIfEmpty,
} from "../scripts/seed-equivalencies.mjs";

test("loadEquivalencySeedData loads the 6 extracted local Kamus Ekuivalensi groups and 20 values", () => {
  const groups = loadEquivalencySeedData();
  assert.equal(groups.length, 6);

  const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
  assert.equal(byName.Terms_of_Delivery?.canonical, "CIF");
  assert.equal(byName.Identitas_Penjual?.canonical, "MARUBENI-ITOCHU STEEL INC");
  assert.equal(byName.Identitas_Pembeli?.canonical, "PT. UNITED STEEL CENTER INDONESIA");
  assert.equal(byName.Pelabuhan_Asal?.canonical, "KWANGYANG");
  assert.equal(byName.Pelabuhan_Tujuan?.canonical, "TANJUNG PRIOK");
  assert.equal(byName.Deskripsi_Barang?.canonical, "COLD ROLLED COIL");

  const totalValues = groups.reduce((sum, g) => sum + g.values.length, 0);
  assert.equal(totalValues, 20);
});

test("deduplicateCaseInsensitive collapses case-only duplicates and blanks", () => {
  assert.deepEqual(deduplicateCaseInsensitive(["  JAKARTA ", "jakarta", "", "KOREA"]), [
    "JAKARTA",
    "KOREA",
  ]);
});

test("seedEquivalenciesIfEmpty skips when VPS table already contains groups", async () => {
  let txCalled = false;
  const mockPrisma = {
    equivalencyGroup: {
      count: async () => 2,
    },
    $transaction: async () => {
      txCalled = true;
    },
  };

  const silentLogger = { log: () => {} };
  const result = await seedEquivalenciesIfEmpty(mockPrisma, { logger: silentLogger });
  assert.deepEqual(result, {
    skipped: true,
    existingCount: 2,
    createdGroups: 0,
    createdValues: 0,
  });
  assert.equal(txCalled, false);
});

test("seedEquivalenciesIfEmpty seeds all 6 groups and 20 values when table is empty", async () => {
  const createdRecords = [];
  const mockPrisma = {
    equivalencyGroup: {
      count: async () => 0,
    },
    $transaction: async (fn) => {
      const tx = {
        equivalencyGroup: {
          create: async ({ data }) => {
            createdRecords.push(data);
            return { id: createdRecords.length, ...data };
          },
        },
      };
      return fn(tx);
    },
  };

  const silentLogger = { log: () => {} };
  const result = await seedEquivalenciesIfEmpty(mockPrisma, { logger: silentLogger });
  assert.deepEqual(result, {
    skipped: false,
    existingCount: 0,
    createdGroups: 6,
    createdValues: 20,
  });
  assert.equal(createdRecords.length, 6);
  assert.equal(createdRecords[1]?.name, "Identitas_Penjual");
  assert.equal(createdRecords[1]?.values?.create?.length, 8);
});
