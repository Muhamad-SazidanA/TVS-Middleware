import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const b = await prisma.batch.findUnique({
    where: { id: "0018" },
    include: { details: true },
  });

  const pib = b.details.find((d) => d.fileType.toLowerCase().includes("pib"));
  const raw = JSON.parse(pib.isi);
  console.log("=== AUTHENTIC WEBHOOK PIB ===");
  console.log("Fields:", JSON.stringify(raw.fields, null, 2));
  console.log("Table Row 0:", JSON.stringify(raw.table?.[0], null, 2));

  const inv = b.details.find((d) => d.fileType.toLowerCase().includes("invoice") || d.fileType.toLowerCase() === "ci");
  const rawInv = JSON.parse(inv.isi);
  console.log("\n=== AUTHENTIC WEBHOOK INVOICE ===");
  console.log("Invoice Fields:", JSON.stringify(rawInv.fields, null, 2));
}

main().finally(() => prisma.$disconnect());
