import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { createBatchLog } from "~/server/logger";
import type { ManualNote } from "~/app/matching/_components/detailTypes";

export const dynamic = "force-dynamic";

interface ParsedIsiData {
  fields?: Record<string, string>;
  table?: Array<Record<string, unknown>>;
  manualEdits?: Record<string, unknown>;
  manualNotes?: ManualNote[];
  [key: string]: unknown;
}

function parseIsi(isi: unknown): ParsedIsiData {
  if (!isi) return { fields: {}, table: [], manualNotes: [] };
  try {
    const parsed = typeof isi === "string" ? JSON.parse(isi) : isi;
    if (parsed && typeof parsed === "object") {
      if (!Array.isArray(parsed.manualNotes)) {
        parsed.manualNotes = [];
      }
      return parsed as ParsedIsiData;
    }
    return { fields: {}, table: [], manualNotes: [] };
  } catch {
    return { fields: {}, table: [], manualNotes: [] };
  }
}

// GET: Fetch notes for a batch, optionally filtered by detailId, docCode, or targetKey
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const url = new URL(req.url);
    const detailIdParam = url.searchParams.get("detailId");
    const docCodeParam = url.searchParams.get("docCode");
    const targetKeyParam = url.searchParams.get("targetKey");

    if (!batchId) {
      return NextResponse.json({ error: "batchId wajib disertakan." }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = await (db as any).detailBatch.findMany({
      where: { batchId },
    });

    const notes: ManualNote[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of details) {
      if (detailIdParam && String(d.id) !== detailIdParam) {
        continue;
      }
      if (docCodeParam && d.fileType && !d.fileType.toLowerCase().includes(docCodeParam.toLowerCase())) {
        continue;
      }
      const parsed = parseIsi(d.isi);
      const docNotes = parsed.manualNotes || [];
      for (const n of docNotes) {
        if (!n.detailId) n.detailId = d.id;
        if (!n.docCode && d.fileType) n.docCode = d.fileType;
        if (targetKeyParam && n.targetKey !== targetKeyParam) {
          continue;
        }
        notes.push(n);
      }
    }

    return NextResponse.json({ success: true, notes });
  } catch (err) {
    console.error("GET notes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil catatan." },
      { status: 500 }
    );
  }
}

// POST: Add a new manual note
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await req.json();
    const { detailId, docCode, targetType, targetKey, text, author } = body;

    if (!batchId || !targetKey || !text || String(text).trim() === "") {
      return NextResponse.json(
        { error: "batchId, targetKey, dan text wajib diisi." },
        { status: 400 }
      );
    }

    // Find target DetailBatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detail: any = null;

    if (detailId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail = await (db as any).detailBatch.findUnique({
        where: { id: Number(detailId) },
      });
    }

    if (!detail) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allDetails = await (db as any).detailBatch.findMany({
        where: { batchId },
      });

      if (docCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail = allDetails.find((d: any) =>
          d.fileType && d.fileType.toLowerCase().includes(docCode.toLowerCase())
        );
      }

      if (!detail && allDetails.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail = allDetails.find((d: any) => (d.fileType || "").toLowerCase().includes("pib")) || allDetails[0];
      }
    }

    if (!detail) {
      return NextResponse.json(
        { error: "Dokumen detail tidak ditemukan dalam batch ini." },
        { status: 404 }
      );
    }

    const isiObj = parseIsi(detail.isi);
    if (!Array.isArray(isiObj.manualNotes)) {
      isiObj.manualNotes = [];
    }

    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newNote: ManualNote = {
      id: noteId,
      targetType: targetType === "line_item" ? "line_item" : "field",
      targetKey: String(targetKey).trim(),
      docCode: docCode || detail.fileType || "PIB",
      detailId: detail.id,
      text: String(text).trim(),
      author: author ? String(author).trim() : "Operator",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    isiObj.manualNotes.push(newNote);

    // Save updated DetailBatch.isi
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).detailBatch.update({
      where: { id: detail.id },
      data: { isi: JSON.stringify(isiObj) },
    });

    // Write audit log entry in batch_logs
    await createBatchLog({
      batchId,
      step: "MANUAL_NOTE",
      stepNumber: 8,
      level: "INFO",
      title: `Tambah Catatan Manual: ${newNote.targetKey} (${detail.fileType || "Dokumen"})`,
      message: `Operator (${newNote.author}) menambahkan catatan manual pada ${newNote.targetType} "${newNote.targetKey}": "${newNote.text}".`,
      fileType: detail.fileType,
      fileName: detail.fileId,
      details: {
        action: "CREATE",
        noteId: newNote.id,
        targetType: newNote.targetType,
        targetKey: newNote.targetKey,
        text: newNote.text,
        author: newNote.author,
      },
    });

    return NextResponse.json({ success: true, note: newNote }, { status: 201 });
  } catch (err) {
    console.error("POST note error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menambahkan catatan." },
      { status: 500 }
    );
  }
}

// PUT: Update an existing manual note
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await req.json();
    const { noteId, text } = body;

    if (!batchId || !noteId || !text || String(text).trim() === "") {
      return NextResponse.json(
        { error: "batchId, noteId, dan text wajib diisi." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails = await (db as any).detailBatch.findMany({
      where: { batchId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetDetail: any = null;
    let targetNote: ManualNote | null = null;
    let targetIsi: ParsedIsiData | null = null;

    for (const d of allDetails) {
      const parsed = parseIsi(d.isi);
      const found = (parsed.manualNotes || []).find((n) => n.id === noteId);
      if (found) {
        targetDetail = d;
        targetNote = found;
        targetIsi = parsed;
        break;
      }
    }

    if (!targetDetail || !targetNote || !targetIsi) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    targetNote.text = String(text).trim();
    targetNote.updatedAt = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).detailBatch.update({
      where: { id: targetDetail.id },
      data: { isi: JSON.stringify(targetIsi) },
    });

    // Write audit log entry in batch_logs
    await createBatchLog({
      batchId,
      step: "MANUAL_NOTE",
      stepNumber: 8,
      level: "INFO",
      title: `Perbarui Catatan Manual: ${targetNote.targetKey} (${targetDetail.fileType || "Dokumen"})`,
      message: `Operator memperbarui catatan manual pada ${targetNote.targetType} "${targetNote.targetKey}": "${targetNote.text}".`,
      fileType: targetDetail.fileType,
      fileName: targetDetail.fileId,
      details: {
        action: "UPDATE",
        noteId: targetNote.id,
        targetType: targetNote.targetType,
        targetKey: targetNote.targetKey,
        text: targetNote.text,
      },
    });

    return NextResponse.json({ success: true, note: targetNote });
  } catch (err) {
    console.error("PUT note error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui catatan." },
      { status: 500 }
    );
  }
}

// DELETE: Remove an existing manual note
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const url = new URL(req.url);
    let noteId = url.searchParams.get("noteId");

    if (!noteId) {
      try {
        const body = await req.json();
        noteId = body.noteId;
      } catch {
        // ignore json parse error on DELETE
      }
    }

    if (!batchId || !noteId) {
      return NextResponse.json(
        { error: "batchId dan noteId wajib diisi." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails = await (db as any).detailBatch.findMany({
      where: { batchId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetDetail: any = null;
    let deletedNote: ManualNote | null = null;
    let targetIsi: ParsedIsiData | null = null;

    for (const d of allDetails) {
      const parsed = parseIsi(d.isi);
      const found = (parsed.manualNotes || []).find((n) => n.id === noteId);
      if (found) {
        targetDetail = d;
        deletedNote = found;
        targetIsi = parsed;
        break;
      }
    }

    if (!targetDetail || !deletedNote || !targetIsi) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    targetIsi.manualNotes = (targetIsi.manualNotes || []).filter((n) => n.id !== noteId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).detailBatch.update({
      where: { id: targetDetail.id },
      data: { isi: JSON.stringify(targetIsi) },
    });

    // Write audit log entry in batch_logs
    await createBatchLog({
      batchId,
      step: "MANUAL_NOTE",
      stepNumber: 8,
      level: "INFO",
      title: `Hapus Catatan Manual: ${deletedNote.targetKey} (${targetDetail.fileType || "Dokumen"})`,
      message: `Operator menghapus catatan manual pada ${deletedNote.targetType} "${deletedNote.targetKey}".`,
      fileType: targetDetail.fileType,
      fileName: targetDetail.fileId,
      details: {
        action: "DELETE",
        noteId,
        targetType: deletedNote.targetType,
        targetKey: deletedNote.targetKey,
      },
    });

    return NextResponse.json({ success: true, deletedNoteId: noteId });
  } catch (err) {
    console.error("DELETE note error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menghapus catatan." },
      { status: 500 }
    );
  }
}
