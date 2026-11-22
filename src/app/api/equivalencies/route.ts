import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { logSystemAudit } from "~/server/auditLogger";

export const dynamic = "force-dynamic";

/**
 * GET /api/equivalencies
 * Returns all equivalency groups with their values.
 */
export async function GET() {
  try {
    const groups = await db.equivalencyGroup.findMany({
      include: { values: true },
      orderBy: { id: "asc" },
    });
    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      canonical: g.canonical,
      values: g.values.map((v) => ({ id: v.id, value: v.value })),
    }));
    return NextResponse.json({ success: true, groups: result, total: result.length });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Helper to deduplicate values case-insensitively.
 * MySQL unique constraint is case-insensitive, so 'JAKARTA' and 'Jakarta' collide.
 */
function deduplicateCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
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
 * POST /api/equivalencies
 * Creates a new equivalency group.
 * Body: { name, category, canonical, values: string[] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; category?: string; canonical?: string; values?: string[] };
    const { name, category = "general", canonical, values = [] } = body;

    if (!name || !canonical) {
      return NextResponse.json(
        { success: false, error: "Nama grup dan nilai acuan (canonical) wajib diisi." },
        { status: 400 }
      );
    }

    const trimmedCanonical = canonical.trim();
    const cleanValues = deduplicateCaseInsensitive(values);

    const group = await db.equivalencyGroup.create({
      data: {
        name: name.trim(),
        category,
        canonical: trimmedCanonical,
        values: {
          create: cleanValues.map((v) => ({ value: v })),
        },
      },
      include: { values: true },
    });

    await logSystemAudit({
      action: "CREATE",
      category: "EQUIVALENCY",
      title: `Tambah Aturan Kamus: ${group.name}`,
      details: `Kategori: ${group.category}, Canonical: "${group.canonical}", ${cleanValues.length} variasi nilai didaftarkan.`,
      metadata: {
        groupId: group.id,
        name: group.name,
        category: group.category,
        canonical: group.canonical,
        values: cleanValues,
      },
    }).catch((err) => console.warn("[Audit] Failed to log Equivalency create:", err));

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        category: group.category,
        canonical: group.canonical,
        values: group.values.map((v) => ({ id: v.id, value: v.value })),
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.includes("Unique constraint failed") || errMessage.includes("equivalency_values_groupId_value_key")) {
      return NextResponse.json(
        { success: false, error: "Terdapat nilai yang duplikat dalam grup (huruf besar/kecil dianggap sama)." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: errMessage || "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
