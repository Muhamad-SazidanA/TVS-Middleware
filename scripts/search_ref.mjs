import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const ds = await prisma.detailBatch.findMany({ where: { batchId: "0004" } });
  for (const d of ds) {
    if (d.isi.includes("01S7200813")) {
      console.log("Found in", d.fileType);
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
