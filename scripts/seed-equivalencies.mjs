import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const DEFAULT_EQUIVALENCY_SEED_PATH = path.resolve(
  process.cwd(),
  "prisma",
  "equivalency-seed.json"
);

/**
 * Deduplicates equivalency values case-insensitively while preserving the first non-empty spelling.
 */
export function deduplicateCaseInsensitive(values) {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(values) ? values : []) {
    if (!raw) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Loads and normalizes equivalency dictionary groups from a JSON seed file.
 */
export function loadEquivalencySeedData(filePath = DEFAULT_EQUIVALENCY_SEED_PATH) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Format prisma/equivalency-seed.json harus berupa array grup.");
  }

  return parsed
    .filter((g) => g && g.name && g.canonical)
    .map((g) => ({
      name: String(g.name).trim(),
      category: String(g.category || "general").trim() || "general",
      canonical: String(g.canonical).trim(),
      values: deduplicateCaseInsensitive(g.values),
    }));
}

/**
 * Populates Kamus Ekuivalensi only when the target table is currently empty,
 * so live edits or deletions made in Manage System on VPS are preserved across restarts.
 */
export async function seedEquivalenciesIfEmpty(prismaClient, options = {}) {
  const { seedPath = DEFAULT_EQUIVALENCY_SEED_PATH, logger = console } = options;

  const existingCount = await prismaClient.equivalencyGroup.count();
  if (existingCount > 0) {
    logger.log(
      `[equivalency-seed] Kamus Ekuivalensi already has ${existingCount} group(s); skipping auto-seed.`
    );
    return { skipped: true, existingCount, createdGroups: 0, createdValues: 0 };
  }

  const groups = loadEquivalencySeedData(seedPath);
  if (groups.length === 0) {
    logger.log("[equivalency-seed] No equivalency seed entries found; skipping.");
    return { skipped: true, existingCount: 0, createdGroups: 0, createdValues: 0 };
  }

  let createdGroups = 0;
  let createdValues = 0;

  await prismaClient.$transaction(async (tx) => {
    for (const group of groups) {
      await tx.equivalencyGroup.create({
        data: {
          name: group.name,
          category: group.category,
          canonical: group.canonical,
          values: {
            create: group.values.map((v) => ({ value: v })),
          },
        },
      });
      createdGroups += 1;
      createdValues += group.values.length;
    }
  });

  logger.log(
    `[equivalency-seed] Seeded ${createdGroups} Kamus Ekuivalensi group(s) (${createdValues} variation values).`
  );
  return { skipped: false, existingCount: 0, createdGroups, createdValues };
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  seedEquivalenciesIfEmpty(prisma)
    .catch((err) => {
      console.error("[equivalency-seed] Error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
