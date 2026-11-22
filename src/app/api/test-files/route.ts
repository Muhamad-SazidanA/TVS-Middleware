import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { normalizeDocumentType, FIELD_SYNONYMS } from "~/utils/documentRegistry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const docScopeFilter = searchParams.get("docScope") || "all";
    const normFilter = normalizeDocumentType(docScopeFilter);

    // 1. Query uploaded details from database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let details: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details = await (db as any).detailBatch.findMany({
        where: {
          isi: {
            not: null,
          },
        },
        include: {
          batch: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });
    } catch (dbErr) {
      console.warn("[TestFiles API] Database query warning:", dbErr);
      details = [];
    }

    // 2. Format details into TestFile items
    const dbFiles: Array<{
      id: string;
      detailId: number;
      batchId: string;
      fileName: string;
      fileSize?: string;
      fileUrl?: string;
      docScope: string;
      fieldValues: Record<string, string>;
      pageCount: string;
      isDb: boolean;
      uploadedAt: string;
    }> = [];

    for (const d of details) {
      if (!d.isi || typeof d.isi !== "string" || !d.isi.trim()) continue;
      try {
        const parsed = JSON.parse(d.isi);
        const normType = normalizeDocumentType(d.fileType);

        // If filter is specific and doesn't match, skip
        if (normFilter !== "all" && normType !== normFilter) {
          continue;
        }

        const rawFields: Record<string, string> = {};
        if (parsed.fields && typeof parsed.fields === "object") {
          for (const [k, v] of Object.entries(parsed.fields)) {
            if (v !== undefined && v !== null) {
              rawFields[k] = String(v);
            }
          }
        }

        // Also check if table has rows, add line 1 fields as sample
        if (Array.isArray(parsed.table) && parsed.table.length > 0) {
          for (const [k, v] of Object.entries(parsed.table[0])) {
            if (v !== undefined && v !== null && !rawFields[k]) {
              rawFields[k] = String(v);
            }
          }
        }

        // Auto-populate recognized aliases (e.g. Pemilik_Barang <-> Nama_Importir)
        for (const [canonical, aliases] of Object.entries(FIELD_SYNONYMS)) {
          if (!rawFields[canonical]) {
            for (const alias of aliases) {
              if (rawFields[alias]) {
                rawFields[canonical] = rawFields[alias];
                break;
              }
            }
          }
        }

        let fileName = parsed.originalFileName;
        if (!fileName || fileName.startsWith("blob:") || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(fileName)) {
          const docLabel =
            normType === "ci"
              ? "Invoice.pdf"
              : normType === "pib"
              ? "PIB_Document.pdf"
              : normType === "pl"
              ? "Packing_List.pdf"
              : normType === "bl"
              ? "Bill_Of_Lading.pdf"
              : normType === "ak"
              ? "Form_AK.pdf"
              : normType === "wl"
              ? "Weight_List.pdf"
              : normType === "ms"
              ? "Mill_Test_Cert.pdf"
              : `${d.fileType || "Dokumen"}.pdf`;
          fileName = `${docLabel} (Batch #${d.batchId})`;
        }

        dbFiles.push({
          id: `db-${d.id}`,
          detailId: d.id,
          batchId: d.batchId,
          fileName,
          fileSize: "Uploaded",
          fileUrl: parsed.fileUrl || undefined,
          docScope: normType,
          fieldValues: rawFields,
          pageCount: parsed.pageCount || "Page 1/3",
          isDb: true,
          uploadedAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[TestFiles API] Parse detail error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      files: dbFiles,
      total: dbFiles.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
