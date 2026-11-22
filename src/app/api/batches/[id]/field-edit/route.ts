import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { createBatchLog } from "~/server/logger";
import { evaluateDbBatchStatus } from "~/server/matchingEngine";
import { loadServerEquivalencyGroups } from "~/server/equivalencyLoader";
import { logSystemAudit } from "~/server/auditLogger";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await req.json();
    const { detailId, fieldName, newValue, oldValue, tableIndex } = body;

    if (!batchId || !detailId || !fieldName) {
      return NextResponse.json(
        { error: "Parameter batchId, detailId, dan fieldName wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Fetch detailBatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = await (db as any).detailBatch.findUnique({
      where: { id: Number(detailId) },
    });

    if (!detail || detail.batchId !== batchId) {
      return NextResponse.json(
        { error: "Dokumen detail tidak ditemukan dalam batch ini." },
        { status: 404 }
      );
    }

    // 2. Parse current isi
    let isiObj: {
      fields: Record<string, string>;
      table: Array<Record<string, string>>;
      manualEdits?: Record<string, { oldValue: string; newValue: string; editedAt: string }>;
      [key: string]: unknown;
    } = { fields: {}, table: [] };

    try {
      if (detail.isi) {
        isiObj = typeof detail.isi === "string" ? JSON.parse(detail.isi) : detail.isi;
      }
    } catch {
      isiObj = { fields: {}, table: [] };
    }

    if (!isiObj.fields || typeof isiObj.fields !== "object") {
      isiObj.fields = {};
    }
    if (!Array.isArray(isiObj.table)) {
      isiObj.table = [];
    }
    if (!isiObj.manualEdits || typeof isiObj.manualEdits !== "object") {
      isiObj.manualEdits = {};
    }

    const cleanNewVal = String(newValue ?? "").trim();
    const cleanOldVal = String(oldValue ?? "").trim();

    // Synonym map for cross-document / cross-field consistency
    const normKey = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const synonymMap: Record<string, string[]> = {
      identitaspenjual: ["identitaspenjual", "namapenjual", "identitassupplier", "supplier", "exporter", "seller", "shipper"],
      namapenjual: ["identitaspenjual", "namapenjual", "identitassupplier", "supplier", "exporter", "seller", "shipper"],
      identitassupplier: ["identitaspenjual", "namapenjual", "identitassupplier", "supplier", "exporter", "seller", "shipper"],
      identitaspembeli: ["identitaspembeli", "namaimportir", "importir", "buyer", "consignee", "soldto", "customer", "pemilikbarang"],
      namaimportir: ["identitaspembeli", "namaimportir", "importir", "buyer", "consignee", "pemilikbarang"],
      pemilikbarang: ["identitaspembeli", "namaimportir", "importir", "buyer", "consignee", "pemilikbarang"],
      deskripsibarang: ["deskripsibarang", "uraianbarang", "description", "descriptionofgoods", "itemdescription"],
      uraianbarang: ["deskripsibarang", "uraianbarang", "description", "descriptionofgoods", "itemdescription"],
      spesifikasigrade: ["spesifikasigrade", "grade", "specification", "spesifikasi", "spekmaterial", "standard", "steelgrade"],
      spekmaterial: ["spesifikasigrade", "grade", "specification", "spesifikasi", "spekmaterial", "standard", "steelgrade"],
      ukuranbarang: ["ukuranbarang", "size", "dimension", "dimensions", "ukuran", "thickness", "ukurandimensi"],
      ukurandimensi: ["ukuranbarang", "size", "dimension", "dimensions", "ukuran", "thickness", "ukurandimensi"],
      jumlahcoil: ["jumlahcoil", "totalcoils", "coils", "qtycoil", "jumlah", "qty", "totalpackages", "jumlahkemasan", "jumlahsatuanbarang", "jumlahsatuanpackage"],
      totalcoils: ["jumlahcoil", "totalcoils", "coils", "qtycoil", "jumlah", "qty", "totalpackages", "jumlahkemasan"],
      jumlahpackage: ["jumlahcoil", "totalcoils", "jumlah", "qty", "totalpackages", "jumlahkemasan", "jumlahpackage"],
      beratkotor: ["beratkotor", "grossweight", "totalgrossweight", "gw"],
      beratbersih: ["beratbersih", "netweight", "totalnetweight", "nw"],
      totalberat: ["totalberat", "totalweight", "totalnetweight", "totalgrossweight", "beratbersih", "beratkotor"],
      jumlahberatmaterial: ["jumlahberatmaterial", "totalweight", "weight", "netweight", "totalnetweight", "beratbersih"],
      nilaitotalinvoice: ["nilaitotalinvoice", "total", "nilaitotal", "totalamount", "invoicetotal", "nilai", "nilaipabean"],
      nilaipabean: ["nilaipabean", "nilaitotalinvoice", "total", "nilaitotal", "nilai"],
      postarif: ["postarif", "hscode", "hsnumber", "tariffcode", "tarifpos"],
      hscode: ["postarif", "hscode", "hsnumber", "tariffcode", "tarifpos"],
      hargasatuan: ["hargasatuan", "unitprice", "price", "rate"],
      noinvoice: ["noinvoice", "invoicenumber", "nomorinvoice", "invnumber"],
      invoicenumber: ["noinvoice", "invoicenumber", "nomorinvoice", "invnumber"],
      tanggalinvoice: ["tanggalinvoice", "invoicedate"],
      invoicedate: ["tanggalinvoice", "invoicedate"],
      nobl: ["nobl", "nohousebl", "housebl", "nomasterbl", "masterbl", "blnumber"],
      tanggalbl: ["tanggalbl", "housebldate", "masterbldate", "dateofissue", "bldate"],
      noreferensi: ["noreferensi", "referenceno", "certificateno", "electroniccertificateoforigineco", "eco"],
      pelabuhanmuat: ["pelabuhanmuat", "pelabuhanasal", "portofloading"],
      pelabuhantujuan: ["pelabuhantujuan", "destination", "portofdischarge", "pelabuhanbongkar"],
      moda: ["moda", "shippedper", "vessel", "vesselname", "namakapal", "namasaranapengangkutan", "namavessel"],
    };

    const synonyms = synonymMap[normKey] || [normKey];

    // Preserve original key if not set yet
    if (isiObj.fields[fieldName] === undefined && cleanOldVal && cleanOldVal !== "-") {
      isiObj.fields[fieldName] = cleanOldVal;
    }
    // Set user-modified data action field
    isiObj.fields[`${fieldName}_action`] = cleanNewVal;

    // Also update any existing fields matching synonyms
    for (const [fk, fv] of Object.entries(isiObj.fields)) {
      const cleanFk = fk.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (synonyms.includes(cleanFk) && !fk.endsWith("_action")) {
        isiObj.fields[`${fk}_action`] = cleanNewVal;
      }
    }

    // If table item specified or exists, update matching column in table
    const updateTableRow = (row: Record<string, string>) => {
      row[`${fieldName}_action`] = cleanNewVal;
      for (const [colKey] of Object.entries(row)) {
        const cleanCol = colKey.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (synonyms.includes(cleanCol) && !colKey.endsWith("_action")) {
          row[`${colKey}_action`] = cleanNewVal;
        }
      }
    };

    if (tableIndex !== undefined && Number(tableIndex) >= 0 && isiObj.table[Number(tableIndex)]) {
      const row = isiObj.table[Number(tableIndex)];
      if (row) updateTableRow(row);
    } else if (isiObj.table.length > 0) {
      const firstRow = isiObj.table[0];
      if (firstRow) updateTableRow(firstRow);
    }

    // Record manual edit metadata
    const editEntry = {
      oldValue: cleanOldVal || "-",
      newValue: cleanNewVal,
      editedAt: new Date().toISOString(),
    };
    isiObj.manualEdits[fieldName] = editEntry;
    for (const syn of synonyms) {
      isiObj.manualEdits[syn] = editEntry;
    }

    const updatedIsiStr = JSON.stringify(isiObj);

    // 3. Update detailBatch in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedDetail = await (db as any).detailBatch.update({
      where: { id: Number(detailId) },
      data: { isi: updatedIsiStr },
    });

    // 4. Create Audit Log in batch_logs
    const session = await auth();
    const actionByName = session?.user?.name || session?.user?.email || "Operator";

    await createBatchLog({
      batchId,
      step: "MANUAL_OVERRIDE",
      stepNumber: 7,
      level: "INFO",
      title: `Koreksi Manual: ${fieldName} (${detail.fileType})`,
      message: `${actionByName} mengoreksi field "${fieldName}" pada dokumen "${detail.fileType}" dari "${cleanOldVal || "-"}" menjadi "${cleanNewVal}".`,
      fileType: detail.fileType,
      fileName: detail.fileId,
      details: {
        field: fieldName,
        oldValue: cleanOldVal || "-",
        newValue: cleanNewVal,
        editedAt: new Date().toISOString(),
      },
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).actionLog.create({
        data: {
          batchId,
          docType: detail.fileType,
          docNumber: detail.nomorAju || detail.nomorInvoice || batchId,
          fieldName,
          oldValue: cleanOldVal || "-",
          newValue: cleanNewVal,
          notes: `Koreksi nilai manual oleh ${actionByName}`,
          actionBy: actionByName,
        },
      });
    } catch (alErr) {
      console.warn("Failed recording actionLog:", alErr);
    }

    await logSystemAudit({
      action: "OVERRIDE",
      category: "BATCH_DATA",
      title: `Koreksi Manual: ${fieldName} (${detail.fileType})`,
      details: `Field "${fieldName}" diubah dari "${cleanOldVal || "-"}" menjadi "${cleanNewVal}". Dokumen: ${detail.fileType} (Batch #${batchId})`,
      metadata: {
        batchId,
        detailId,
        fileType: detail.fileType,
        fieldName,
        oldValue: cleanOldVal || "-",
        newValue: cleanNewVal,
      },
      userName: actionByName,
      userEmail: session?.user?.email || undefined,
      userId: session?.user?.id || undefined,
    }).catch((err) => console.warn("[Audit] Failed to log field-edit override:", err));

    // 5. Re-evaluate overall batch matching status
    const serverGroups = await loadServerEquivalencyGroups();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails = await (db as any).detailBatch.findMany({
      where: { batchId },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchRecord = await (db as any).batch.findUnique({
      where: { id: batchId },
    });

    const evaluatedStatus = evaluateDbBatchStatus(
      allDetails,
      batchRecord?.totalFile,
      serverGroups
    );

    const dbStatusStr =
      evaluatedStatus === "Matching"
        ? "MATCHING"
        : evaluatedStatus === "Mismatching"
        ? "MISMATCHING"
        : "PROSES";

    if (batchRecord && batchRecord.status !== dbStatusStr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).batch.update({
        where: { id: batchId },
        data: { status: dbStatusStr },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Field "${fieldName}" berhasil diperbarui.`,
      updatedDetail,
      batchStatus: evaluatedStatus,
    });
  } catch (error: unknown) {
    console.error("Error updating field:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

