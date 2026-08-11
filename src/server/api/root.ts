import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Primary router for server.
 */
export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" })),
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
