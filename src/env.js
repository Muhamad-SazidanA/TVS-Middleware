import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_KEY: z.string().optional(),
    MODEL_PIB: z.string().optional(),
    MODEL_PIB_LANJUTAN: z.string().optional(),
    MODEL_INVOICE: z.string().optional(),
    MODEL_BL: z.string().optional(),
    MODEL_MASTER_BL: z.string().optional(),
    MODEL_PACKING_LIST: z.string().optional(),
    MODEL_RECAP_DOCUMENT: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    API_KEY: process.env.API_KEY,
    MODEL_PIB: process.env.MODEL_PIB,
    MODEL_PIB_LANJUTAN: process.env.MODEL_PIB_LANJUTAN,
    MODEL_INVOICE: process.env.MODEL_INVOICE,
    MODEL_BL: process.env.MODEL_BL,
    MODEL_MASTER_BL: process.env.MODEL_MASTER_BL,
    MODEL_PACKING_LIST: process.env.MODEL_PACKING_LIST,
    MODEL_RECAP_DOCUMENT: process.env.MODEL_RECAP_DOCUMENT,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});