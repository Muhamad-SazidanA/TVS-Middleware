import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

function parseIsi(isi?: string | null) {
  if (!isi) return { fields: {}, table: [] };
  try {
    const p = typeof isi === "string" ? JSON.parse(isi) : isi;
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: (p as any)?.fields || (p as any)?.prediction?.fields || p || {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: Array.isArray((p as any)?.table) ? (p as any).table : Array.isArray((p as any)?.prediction?.table) ? (p as any).prediction.table : [],
    };
  } catch {
    return { fields: {}, table: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVal(fields: Record<string, any>, ...keys: string[]): string {
  if (!fields) return "-";
  for (const k of keys) {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== "") {
      const v = typeof fields[k] === "object" ? fields[k]?.value : fields[k];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
  }
  return "-";
}

function parseNumericValue(val: any): number {
  if (val === undefined || val === null || val === "" || val === "-") return 0;
  const s = String(val).trim();
  const cleaned = s.replace(/[^0-9.,]/g, "");
  if (!cleaned) return 0;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    } else {
      return parseFloat(cleaned.replace(",", ".")) || 0;
    }
  } else {
    return parseFloat(cleaned) || 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluateDbBatchStatus(details: any[], totalFile?: number): "Matching" | "Mismatching" | "Proses" {
  if (!details || !Array.isArray(details) || details.length === 0) {
    return "Proses";
  }

  if (totalFile && totalFile > 0 && details.length < totalFile) {
    return "Proses";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filledDetails = details.filter((d: any) => {
    if (!d.isi || typeof d.isi !== "string" || !d.isi.trim() || d.isi.trim() === "{}" || d.isi.trim() === "[]") return false;
    try {
      const p = JSON.parse(d.isi);
      const fields = p?.fields || {};
      const table = Array.isArray(p?.table) ? p.table : [];
      const hasFields = Object.keys(fields).length > 0 && Object.values(fields).some((v: any) => v && String(v).trim() !== "" && String(v).trim() !== "-");
      const hasTable = table.length > 0;
      return hasFields || hasTable;
    } catch {
      return false;
    }
  });

  if (filledDetails.length < details.length) {
    return "Proses";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pibDet = details.find((d: any) => (d.fileType || "").trim().toLowerCase() === "pib");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pibLanjutanDet = details.find((d: any) => (d.fileType || "").trim().toLowerCase().includes("lanjutan"));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supportingDetails = details.filter((d: any) => {
    const ftLower = (d.fileType || "").trim().toLowerCase();
    return ftLower !== "pib" && !ftLower.includes("lanjutan");
  });

  if (!pibDet || supportingDetails.length === 0) {
    return "Proses";
  }

  const pibData = parseIsi(pibDet?.isi);
  const pibLanjutanData = parseIsi(pibLanjutanDet?.isi);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceDetails = supportingDetails.filter((d: any) =>
    (d.fileType || "").trim().toLowerCase().includes("invoice")
  );

  const pibTotalVal = getVal(pibData.fields, "Nilai", "Nilai Total");
  const pibTotalNum = parseNumericValue(pibTotalVal);

  if (invoiceDetails.length > 1 && pibTotalNum > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sumInvoiceTotals = invoiceDetails.reduce((acc: number, det: any) => {
      const dData = parseIsi(det.isi);
      return acc + parseNumericValue(getVal(dData.fields, "Total", "Nilai Total"));
    }, 0);
    if (sumInvoiceTotals > 0 && Math.abs(pibTotalNum - sumInvoiceTotals) > 0.01) {
      return "Mismatching";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packingDetails = supportingDetails.filter((d: any) => {
    const f = (d.fileType || "").trim().toLowerCase();
    return f.includes("packing") || f.includes("paking");
  });

  const pibNetWtVal = getVal(pibData.fields, "Berat_Bersih", "Berat Bersih");
  const pibNetWtNum = parseNumericValue(pibNetWtVal);

  if (packingDetails.length > 1 && pibNetWtNum > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sumPkgNetWts = packingDetails.reduce((acc: number, det: any) => {
      const dData = parseIsi(det.isi);
      return (
        acc +
        parseNumericValue(
          getVal(
            dData.fields,
            "Total_Net_Weight",
            "Total Net Weight",
            "Net_Weight",
            "Net Weight",
            "Berat_Bersih",
            "Berat Bersih"
          )
        )
      );
    }, 0);
    if (sumPkgNetWts > 0 && Math.abs(pibNetWtNum - sumPkgNetWts) > 0.01) {
      return "Mismatching";
    }
  }

  for (const det of supportingDetails) {
    const ft = (det.fileType || "").trim().toLowerCase();
    const data = parseIsi(det.isi);

    if (ft.includes("invoice")) {
      const invNum = getVal(data.fields, "Invoice_Number", "Invoice Number");
      const pibInvNum = getVal(pibData.fields, "Invoice_Number", "Invoice Number");

      let invMatch = pibInvNum !== "-" && invNum !== "-" && pibInvNum.toLowerCase() === invNum.toLowerCase();
      if (!invMatch && invNum !== "-" && pibLanjutanData?.table) {
        const cleanInv = invNum.trim().toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of pibLanjutanData.table as any[]) {
          const docName = String(row["Nama_Document"] || row["nama document"] || "").toLowerCase();
          const docNo = String(row["No_Document"] || row["no document"] || "").trim().toLowerCase();
          if (docName.includes("invoice") && docNo === cleanInv) {
            invMatch = true;
            break;
          }
        }
      }
      if (!invMatch) return "Mismatching";

      const invDate = getVal(data.fields, "Invoice_Date", "Invoice Date");
      const pibInvDate = getVal(pibData.fields, "Invoice_Date", "Invoice Date");
      if (pibInvDate !== "-" && invDate !== "-" && pibInvDate.toLowerCase() !== invDate.toLowerCase()) return "Mismatching";

      const pol = getVal(data.fields, "Port_of_Loading", "Port of Loading");
      const pibPol = getVal(pibData.fields, "Pelabuhan_Muat", "Pelabuhan Muat");
      if (pibPol !== "-" && pol !== "-" && pibPol.toLowerCase() !== pol.toLowerCase()) return "Mismatching";

      const dest = getVal(data.fields, "Destination", "destination");
      const pibDest = getVal(pibData.fields, "Pelabuhan_Tujuan", "Pelabuhan Tujuan");
      if (pibDest !== "-" && dest !== "-") {
        const cleanDest = dest.trim().toLowerCase();
        const cleanPibDest = pibDest.trim().toLowerCase();
        if (cleanDest !== cleanPibDest && !cleanDest.includes(cleanPibDest) && !cleanPibDest.includes(cleanDest)) {
          return "Mismatching";
        }
      }

      const tod = getVal(data.fields, "Terms_of_Delivery", "Terms of Delivery", "Incoterm", "Delivery_Terms", "Delivery Terms");
      const pibTod = getVal(pibData.fields, "Ket_FOB", "Ket FOB", "Incoterm", "Terms_of_Delivery", "Cara_Penyerahan");
      if (pibTod !== "-" && tod !== "-") {
        const cleanTod = tod.trim().toLowerCase();
        const cleanPibTod = pibTod.trim().toLowerCase();
        if (cleanTod !== cleanPibTod && !cleanTod.includes(cleanPibTod) && !cleanPibTod.includes(cleanTod)) {
          return "Mismatching";
        }
      }

      if (invoiceDetails.length === 1 && pibTotalNum > 0) {
        const invTotalVal = getVal(data.fields, "Total", "Nilai Total");
        const invTotalNum = parseNumericValue(invTotalVal);
        if (invTotalNum > 0 && Math.abs(pibTotalNum - invTotalNum) > 0.01) {
          return "Mismatching";
        }
      }
    } else if (ft.includes("packing") || ft.includes("paking")) {
      const pkgInv = getVal(data.fields, "Invoice_Number", "Invoice Number");
      const pibInvNum = getVal(pibData.fields, "Invoice_Number", "Invoice Number");
      let invMatch = pibInvNum !== "-" && pkgInv !== "-" && pibInvNum.toLowerCase() === pkgInv.toLowerCase();
      if (!invMatch && pkgInv !== "-" && pibLanjutanData?.table) {
        const cleanInv = pkgInv.trim().toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of pibLanjutanData.table as any[]) {
          const docName = String(row["Nama_Document"] || row["nama document"] || "").toLowerCase();
          const docNo = String(row["No_Document"] || row["no document"] || "").trim().toLowerCase();
          if (docName.includes("invoice") && docNo === cleanInv) {
            invMatch = true;
            break;
          }
        }
      }
      if (!invMatch) return "Mismatching";

      if (packingDetails.length === 1 && pibNetWtNum > 0) {
        const pkgNetWtVal = getVal(
          data.fields,
          "Total_Net_Weight",
          "Total Net Weight",
          "Net_Weight",
          "Net Weight",
          "Berat_Bersih",
          "Berat Bersih"
        );
        const pkgNetWtNum = parseNumericValue(pkgNetWtVal);
        if (pkgNetWtNum > 0 && Math.abs(pibNetWtNum - pkgNetWtNum) > 0.01) {
          return "Mismatching";
        }
      }
    } else if (ft === "bl" || (ft.includes("bl") && !ft.includes("master"))) {
      const seaWaybill = getVal(data.fields, "Sea_Waybill_Number", "Sea Waybill Number");
      const pibBl = getVal(pibData.fields, "No_House_BL", "No House BL");
      if (pibBl !== "-" && seaWaybill !== "-" && pibBl.toLowerCase() !== seaWaybill.toLowerCase()) return "Mismatching";
    } else if (ft.includes("master")) {
      const masterBl = getVal(data.fields, "BL_Number", "BL Number");
      const pibMasterBl = getVal(pibData.fields, "No_Master_BL", "No Master BL");
      if (pibMasterBl !== "-" && masterBl !== "-" && pibMasterBl.toLowerCase() !== masterBl.toLowerCase()) return "Mismatching";
      const mblType = getVal(data.fields, "Type");
      const pibType = getVal(pibData.fields, "Tipe_Peti", "Tipe Peti");
      if (pibType !== "-" && mblType !== "-" && pibType.toLowerCase().trim() !== mblType.toLowerCase().trim()) return "Mismatching";
    } else if (ft.includes("rekap")) {
      const maxRows = Math.max(pibData.table.length, data.table.length);
      if (maxRows === 0) continue;
      for (let i = 0; i < maxRows; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pibRow = (pibData.table[i] as any) || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rekapRow = (data.table[i] as any) || {};
        const pibHs = String(pibRow["Pos_Tarif"] || pibRow["pos tarif"] || pibRow["pos_tarif"] || pibRow["HS_Code"] || pibRow["hs code"] || "").trim();
        const rekapHs = String(rekapRow["HS_Code"] || rekapRow["hs code"] || rekapRow["pos tarif"] || rekapRow["pos_tarif"] || rekapRow["Pos_Tarif"] || "").trim();
        const pibPart = String(pibRow["Kode_Barang"] || pibRow["kode barang"] || pibRow["kode_barang"] || pibRow["Part_No"] || pibRow["part_no"] || "").trim();
        const rekapPart = String(rekapRow["Part_No"] || rekapRow["part_no"] || rekapRow["no part"] || rekapRow["part no"] || rekapRow["Kode_Barang"] || rekapRow["kode_barang"] || rekapRow["kode barang"] || "").trim();
        const pibQty = String(pibRow["Jumlah_Barang"] || pibRow["jumlah barang"] || pibRow["jumlah_barang"] || pibRow["QTY"] || pibRow["qty"] || pibRow["jumlah"] || "").trim();
        const rekapQty = String(rekapRow["QTY"] || rekapRow["qty"] || rekapRow["jumlah"] || rekapRow["jumlah_barang"] || rekapRow["jumlah barang"] || "").trim();

        const cleanVal = (s: string) => s.toLowerCase().trim();
        const cleanNum = (s: string) => s.toLowerCase().replace(/,/g, "").replace(/\.00$/, "").replace(/\s+/g, "").trim();

        const hasBoth = Boolean((pibHs || pibPart || pibQty) && (rekapHs || rekapPart || rekapQty));
        const isHsMatch = pibHs !== "" && rekapHs !== "" && cleanVal(pibHs) === cleanVal(rekapHs);
        const isPartMatch = pibPart !== "" && rekapPart !== "" && cleanVal(pibPart) === cleanVal(rekapPart);
        const isQtyMatch = pibQty !== "" && rekapQty !== "" && cleanNum(pibQty) === cleanNum(rekapQty);

        const isRowMatch = hasBoth && (isHsMatch || isPartMatch) && (isQtyMatch || !pibQty || !rekapQty);
        if (hasBoth && !isRowMatch) return "Mismatching";
      }
    }
  }

  return "Matching";
}

// 1. READ ALL BATCHES (GET)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status") || "ALL";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBatches: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawBatches = await (db as any).batch.findMany({
        include: {
          details: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbErr) {
      console.warn("Error querying database for batches:", dbErr);
      rawBatches = [];
    }

    // Process and format batches with dynamic live DB evaluation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedBatches = rawBatches.map((batch: any, index: number) => {
      let batchTitle = `Batch #${batch.id}`;
      let batchSubtext = "";

      let importirName = "";
      let docNo = "";

      for (const det of batch.details || []) {
        if (!det.isi) continue;
        const p = parseIsi(det.isi);
        const f = p?.fields || {};
        if (!importirName || importirName === "-") {
          const val = getVal(f, "Nama_Importir", "Nama Importir", "Consignee", "Importir");
          if (val && val !== "-") importirName = val;
        }
        if (!docNo || docNo === "-") {
          const val = getVal(f, "Nomor_Pengajuan", "Nomor Pengajuan", "No_Aju", "No Aju", "Invoice_Number", "Invoice Number");
          if (val && val !== "-") docNo = val;
        }
      }

      const dateStr = batch.createdAt
        ? new Date(batch.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";

      if (importirName) {
        batchTitle = importirName;
        batchSubtext = `Batch #${batch.id}`;
      } else if (docNo) {
        batchTitle = `PIB ${docNo}`;
        batchSubtext = `Batch #${batch.id}`;
      } else {
        batchTitle = `Batch #${batch.id}`;
        batchSubtext = `${batch.totalFile || (batch.details || []).length} File`;
      }

      // Dynamic evaluation from DB details
      const evaluatedStatus = evaluateDbBatchStatus(batch.details || [], batch.totalFile);

      // Async sync to database if DB status is outdated
      const dbStatusStr = evaluatedStatus === "Matching" ? "MATCHING" : evaluatedStatus === "Mismatching" ? "MISMATCHING" : "PROSES";
      if (batch.status !== dbStatusStr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).batch.update({
          where: { id: batch.id },
          data: { status: dbStatusStr },
        }).catch((e: unknown) => console.warn("Failed async DB status update:", e));
      }

      return {
        id: batch.id,
        no: index + 1,
        nama: batchTitle,
        subtext: batchSubtext,
        totalFile: batch.totalFile || (batch.details || []).length || 0,
        status: evaluatedStatus,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        details: batch.details || [],
      };
    });

    // Filter search
    let filteredBatches = formattedBatches;
    if (search) {
      filteredBatches = filteredBatches.filter(
        (b) =>
          b.nama.toLowerCase().includes(search) ||
          b.id.toLowerCase().includes(search) ||
          b.subtext.toLowerCase().includes(search)
      );
    }

    // Filter status
    if (statusFilter && statusFilter.toUpperCase() !== "ALL") {
      const targetStatus =
        statusFilter.toUpperCase() === "MATCHING"
          ? "Matching"
          : statusFilter.toUpperCase() === "MISMATCHING"
          ? "Mismatching"
          : "Proses";
      filteredBatches = filteredBatches.filter((b) => b.status === targetStatus);
    }

    return NextResponse.json({
      success: true,
      batches: filteredBatches,
      total: filteredBatches.length,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error", batches: [] },
      { status: 500 }
    );
  }
}

// 2. CREATE A NEW BATCH (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, totalFile, status } = body;

    let newBatchId = id;
    if (!newBatchId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (db as any).batch.count();
      newBatchId = String(count + 1).padStart(4, "0");
    }

    // Normalize status for DB
    let dbStatus = "PROSES";
    if (status === "Matching") dbStatus = "MATCHING";
    else if (status === "Mismatching") dbStatus = "MISMATCHING";
    else if (status === "Proses") dbStatus = "PROSES";
    else dbStatus = status || "PROSES";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdBatch = await (db as any).batch.create({
      data: {
        id: newBatchId,
        totalFile: Number(totalFile) || 0,
        status: dbStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Batch berhasil dibuat",
      batch: createdBatch,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat batch di database" },
      { status: 500 }
    );
  }
}

// 3. BULK DELETE BATCHES (DELETE)
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Array of batch IDs required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteResult = await (db as any).batch.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} batch berhasil dihapus dari database`,
      deletedCount: deleteResult.count,
    });
  } catch (error: unknown) {
    console.error("Error in DELETE /api/batches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus batch dari database" },
      { status: 500 }
    );
  }
}
