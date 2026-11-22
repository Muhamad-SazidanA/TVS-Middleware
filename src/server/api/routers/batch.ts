import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const batchRouter = createTRPCRouter({
  // Tampilkan antrean aktif (hanya status PROSES, MATCHING, MISMATCHING, REJECT, DUPLIKAT - sembunyikan status FINAL)
  getActiveBatches: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.batch.findMany({
      where: {
        status: { in: ["PROSES", "MATCHING", "MISMATCHING", "REJECT", "DUPLIKAT"] },
      },
      include: {
        details: true,
        logs: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Selesaikan Batch (Pindahkan status ke FINAL agar diarsipkan dari antrean aktif UI)
  finalizeBatch: publicProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.batch.update({
        where: { id: input.batchId },
        data: { status: "FINAL" },
      });
    }),
});
