import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { mybaseAuth, mybaseSecondaryStorage } from "@mybase-dev/sdk/better-auth";
import { prisma } from "./db";
import { cache, mybase } from "./mybase";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Sessions and rate limit counters live in the mybase cache (`lastlayer:auth:*`).
  secondaryStorage: mybaseSecondaryStorage(cache),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      // False until the account has chosen what data to start with.
      onboarded: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    // Also keep sessions in Postgres so the mybase Users page can list and revoke them.
    storeSessionInDatabase: true,
    // Skip the database on most session checks.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [mybaseAuth(mybase), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

/** The signed-in session for this request, or null. */
export async function getSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() });
}
