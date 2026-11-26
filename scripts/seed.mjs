import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { seedEquivalenciesIfEmpty } from "./seed-equivalencies.mjs";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("=== Starting DocMatch Database Seeding ===");

  const defaultPasswordHash = hashPassword("password123");

  // 1. Seed Users
  const usersData = [
    {
      id: "user_a_staff",
      email: "usera@docmatch.id",
      name: "User A",
      role: "STAFF",
      password: defaultPasswordHash,
    },
    {
      id: "user_b_staff",
      email: "userb@docmatch.id",
      name: "User B",
      role: "STAFF",
      password: defaultPasswordHash,
    },
    {
      id: "user_c_staff",
      email: "userc@docmatch.id",
      name: "User C",
      role: "STAFF",
      password: defaultPasswordHash,
    },
    {
      id: "admin_approver",
      email: "admin@docmatch.id",
      name: "Admin Approver",
      role: "APPROVER",
      password: defaultPasswordHash,
    },
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const upserted = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        password: u.password,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        password: u.password,
      },
    });
    createdUsers[u.email] = upserted;
    console.log(`[USER] ${upserted.name} (${upserted.email}) - Role: ${upserted.role}`);
  }

  const userA = createdUsers["usera@docmatch.id"];
  const userB = createdUsers["userb@docmatch.id"];
  const userC = createdUsers["userc@docmatch.id"];
  const admin = createdUsers["admin@docmatch.id"];

  // 2. Assign and update existing batches to users
  // Batch 0004 -> User A (APPROVED)
  await prisma.batch.updateMany({
    where: { id: "0004" },
    data: {
      createdById: userA.id,
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(Date.now() - 3600000 * 24), // 1 day ago
    },
  });

  // Batch 0003 -> User A (PENDING)
  await prisma.batch.updateMany({
    where: { id: "0003" },
    data: {
      createdById: userA.id,
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
  });

  // Batch 0006 -> User A (MATCHING / IN REVIEW)
  await prisma.batch.updateMany({
    where: { id: "0006" },
    data: {
      createdById: userA.id,
      status: "MATCHING",
    },
  });

  // Batch 0008 -> User B (APPROVED)
  await prisma.batch.updateMany({
    where: { id: "0008" },
    data: {
      createdById: userB.id,
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(Date.now() - 3600000 * 12), // 12 hours ago
    },
  });

  // Batch 0007 -> User B (PENDING)
  await prisma.batch.updateMany({
    where: { id: "0007" },
    data: {
      createdById: userB.id,
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
  });

  // Batch 0009 -> User B (MISMATCHING)
  await prisma.batch.updateMany({
    where: { id: "0009" },
    data: {
      createdById: userB.id,
      status: "MISMATCHING",
    },
  });

  // Batch 0014 -> User C (APPROVED)
  await prisma.batch.updateMany({
    where: { id: "0014" },
    data: {
      createdById: userC.id,
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(Date.now() - 3600000 * 6), // 6 hours ago
    },
  });

  // Batch 0012 -> User C (PENDING)
  await prisma.batch.updateMany({
    where: { id: "0012" },
    data: {
      createdById: userC.id,
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
  });

  // Batch 0013 -> User C (DRAFT)
  await prisma.batch.updateMany({
    where: { id: "0013" },
    data: {
      createdById: userC.id,
      status: "DRAFT",
      approvedById: null,
      approvedAt: null,
    },
  });

  // Remaining batches assigned to Admin or Staff
  await prisma.batch.updateMany({
    where: { id: "0015" },
    data: { createdById: admin.id, status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
  });
  await prisma.batch.updateMany({
    where: { id: "0016" },
    data: { createdById: admin.id, status: "MATCHING" },
  });
  await prisma.batch.updateMany({
    where: { id: "0017" },
    data: { createdById: admin.id, status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
  });

  // 3. Status variations on authentic batches (0013 is already DRAFT with real documents)

  // 4. Seed Action Logs (Audit & Revision History)
  const actionLogsData = [
    // User A Logs
    {
      batchId: "0004",
      docType: "PIB",
      docNumber: "002047-PIB-2025",
      fieldName: "Berat_Kotor",
      oldValue: "1,053.689 MT",
      newValue: "1.053.689.0000",
      notes: "Standarisasi pembulatan 4 desimal satuan berat kotor Lembar 1 Box 30",
      actionBy: userA.name,
      createdAt: new Date(Date.now() - 3600000 * 25),
    },
    {
      batchId: "0004",
      docType: "Invoice",
      docNumber: "4JV2X125",
      fieldName: "Ukuran_Barang",
      oldValue: "1.0MM X 821MM X C",
      newValue: "1.0 MM X 821 MM X C",
      notes: "Penambahan spasi unit dimensi coil sesuai pedoman bea cukai",
      actionBy: userA.name,
      createdAt: new Date(Date.now() - 3600000 * 24.5),
    },
    {
      batchId: "0004",
      docType: "BL",
      docNumber: "ASL-2025-0323",
      fieldName: "Pelabuhan_Tujuan",
      oldValue: "JAKARTA INDONESIA",
      newValue: "TANJUNG PRIOK",
      notes: "Sinkronisasi nama pelabuhan pabean Tanjung Priok",
      actionBy: userA.name,
      createdAt: new Date(Date.now() - 3600000 * 24.2),
    },

    // User B Logs
    {
      batchId: "0008",
      docType: "Packing List",
      docNumber: "PL-4JV2X125",
      fieldName: "Gross_Weight",
      oldValue: "18.504",
      newValue: "18.5040",
      notes: "Koreksi format angka desimal berat kotor per coil",
      actionBy: userB.name,
      createdAt: new Date(Date.now() - 3600000 * 13),
    },
    {
      batchId: "0008",
      docType: "PIB",
      docNumber: "002047-PIB-2025",
      fieldName: "Pos_Tarif",
      oldValue: "7208.27.19",
      newValue: "72082719",
      notes: "Format HS Code 8 digit tanpa tanda titik",
      actionBy: userB.name,
      createdAt: new Date(Date.now() - 3600000 * 12.8),
    },

    // User C Logs
    {
      batchId: "0014",
      docType: "Invoice",
      docNumber: "4JV2X125",
      fieldName: "Identitas_Penjual",
      oldValue: "Marubeni-Itochu Steel Inc.",
      newValue: "MARUBENI-ITOCHU STEEL INC",
      notes: "Huruf kapital entitas penjual sesuai registrasi PIB",
      actionBy: userC.name,
      createdAt: new Date(Date.now() - 3600000 * 7),
    },
    {
      batchId: "0014",
      docType: "AK",
      docNumber: "K25-00129",
      fieldName: "Kriteria_Asal_Barang",
      oldValue: "RVC 40%",
      newValue: "RVC 40%",
      notes: "Verifikasi sertifikat COO Form AK asal Korea",
      actionBy: userC.name,
      createdAt: new Date(Date.now() - 3600000 * 6.5),
    },
  ];

  // Clear and re-seed sample action logs only for batches that exist in DB
  const sampleBatchIds = [...new Set(actionLogsData.map((l) => l.batchId))];
  const existingBatches = new Set(
    (
      await prisma.batch.findMany({
        where: { id: { in: sampleBatchIds } },
        select: { id: true },
      })
    ).map((b) => b.id)
  );
  const logsToSeed = actionLogsData.filter((l) => existingBatches.has(l.batchId));

  if (logsToSeed.length === 0) {
    console.log("[ACTION LOGS] No sample batches present yet; skipping sample action logs.");
  } else {
    await prisma.actionLog.deleteMany({
      where: { batchId: { in: [...existingBatches] } },
    });
    for (const log of logsToSeed) {
      await prisma.actionLog.create({
        data: log,
      });
    }
    console.log(`[ACTION LOGS] Seeded ${logsToSeed.length} revision action logs.`);
  }

  // 5. Seed Kamus Ekuivalensi if empty
  await seedEquivalenciesIfEmpty(prisma);

  console.log("=== Seeding Completed Successfully! ===");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
