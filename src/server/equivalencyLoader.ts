import { db } from "~/server/db";

export interface DbEquivalencyGroup {
  id: number;
  name: string;
  category: string;
  canonical: string;
  values: string[];
}

/**
 * Loads all equivalency groups + values from MySQL via Prisma.
 * Server-only. Used by matching engine and API route.
 */
export async function loadServerEquivalencyGroups(): Promise<DbEquivalencyGroup[]> {
  try {
    const groups = await db.equivalencyGroup.findMany({
      include: { values: true },
      orderBy: { id: "asc" },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      canonical: g.canonical,
      values: g.values.map((v) => v.value),
    }));
  } catch (err) {
    console.warn("[equivalencyLoader] Failed to load groups from DB:", err);
    return [];
  }
}
