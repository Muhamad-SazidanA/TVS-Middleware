import { PrismaClient } from "@prisma/client";
import { adaptBatchToModel, buildComparisonFields } from "../src/app/matching/_components/detailAdapter.ts";
import { evaluateCanonicalBatchMatching } from "../src/utils/canonicalMatcher.ts";

const prisma = new PrismaClient();

async function run() {
  const b = await prisma.batch.findUnique({
    where: { id: "0018" },
    include: { details: true },
  });
  const model = adaptBatchToModel(b);
  const beResult = evaluateCanonicalBatchMatching(b.details, b.details.length, b.id, []);

  console.log("BE headerComparison keys:", Object.keys(beResult.headerComparison));
  for (const k of Object.keys(beResult.headerComparison)) {
    console.log(`BE ${k} count: ${beResult.headerComparison[k].length}`);
  }

  for (const sup of model.supporting) {
    const feFields = buildComparisonFields(model.pib, sup);
    console.log(`FE ${sup.code} count: ${feFields.length}`);
  }

  await prisma.$disconnect();
}

run();
