import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const d = await prisma.detailBatch.findFirst({
    where: { batchId: "0004", fileType: { contains: "PIB" } },
  });
  const parsed = JSON.parse(d.isi);
  console.log("PIB line items count:", parsed.table?.length);
  for (let i = 0; i < (parsed.table?.length || 0); i++) {
    const r = parsed.table[i];
    if (r.Pos_Tarif?.includes("7208") || r.Uraian_Barang?.includes("HOT ROLLED") || r.Uraian_Barang?.includes("PO COIL")) {
      console.log(`Row ${i}: Pos_Tarif=${r.Pos_Tarif}, Uraian=${r.Uraian_Barang}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
