import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "~/server/db";
import { verifyPassword } from "./password";

/**
 * Module augmentation for `next-auth` types.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: string;
  }
}

export const authConfig = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        try {
          const user = await db.user.findUnique({
            where: { email },
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = verifyPassword(password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            role: user.role || "STAFF",
          };
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "STAFF";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = (token.role as string) || "STAFF";
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
