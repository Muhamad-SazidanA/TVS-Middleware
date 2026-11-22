import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.batch.findMany({
    select: {
      id: true,
      totalFile: true,
      status: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { id: "asc" },
  });
  console.log(batches);
}

main().finally(() => prisma.$disconnect());
