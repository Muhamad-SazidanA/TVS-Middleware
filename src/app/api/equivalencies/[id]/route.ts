import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { logSystemAudit } from "~/server/auditLogger";

export const dynamic = "force-dynamic";

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
 * PUT /api/equivalencies/[id]
 * Update a group's name, category, canonical, and replace its values.
 * Body: { name?, category?, canonical?, values?: string[] }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
    }

    const body = await req.json() as {
      name?: string;
      category?: string;
      canonical?: string;
      values?: string[];
    };
    const { name, category, canonical, values } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category;
    if (canonical !== undefined) updateData.canonical = canonical.trim();

    // Replace values if provided
    if (values !== undefined) {
      const cleanValues = deduplicateCaseInsensitive(values);
      await db.equivalencyValue.deleteMany({ where: { groupId } });
      updateData.values = {
        create: cleanValues.map((v) => ({ value: v })),
      };
    }

    const group = await db.equivalencyGroup.update({
      where: { id: groupId },
      data: updateData,
      include: { values: true },
    });

    await logSystemAudit({
      action: "UPDATE",
      category: "EQUIVALENCY",
      title: `Perbarui Aturan Kamus: ${group.name}`,
      details: `Kategori: ${group.category}, Canonical: "${group.canonical}", Total variasi: ${group.values.length} nilai.`,
      metadata: {
        groupId: group.id,
        name: group.name,
        category: group.category,
        canonical: group.canonical,
        values: group.values.map((v) => v.value),
      },
    }).catch((err) => console.warn("[Audit] Failed to log Equivalency update:", err));

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
      { success: false, error: errMessage || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/equivalencies/[id]
 * Deletes a group and all its values (cascade).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
    }

    const existing = await db.equivalencyGroup.findUnique({ where: { id: groupId } });
    await db.equivalencyGroup.delete({ where: { id: groupId } });

    await logSystemAudit({
      action: "DELETE",
      category: "EQUIVALENCY",
      title: `Hapus Aturan Kamus: ${existing?.name || `ID #${groupId}`}`,
      details: `Menghapus grup kamus ekuivalensi "${existing?.name || groupId}" beserta seluruh nilai variasinya.`,
      metadata: {
        groupId,
        name: existing?.name,
        canonical: existing?.canonical,
        category: existing?.category,
      },
    }).catch((err) => console.warn("[Audit] Failed to log Equivalency delete:", err));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

