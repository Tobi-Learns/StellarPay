import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import {
  assertTestAuthConfiguration,
  isAuthorizedTestFixture,
  isVerifiedGoogleProfile,
} from "@/lib/auth-policy";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const testAuthEnabled = process.env.STELLARPAY_ENABLE_TEST_AUTH === "true";

assertTestAuthConfiguration(testAuthEnabled, process.env.NODE_ENV);

const providers = [];

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

if (testAuthEnabled) {
  providers.push(
    Credentials({
      id: "test-fixture",
      name: "Test fixture",
      credentials: {
        email: { label: "Fixture email", type: "email" },
        secret: { label: "Test secret", type: "password" },
      },
      async authorize(credentials) {
        const expected = process.env.STELLARPAY_TEST_AUTH_SECRET;
        const provided = typeof credentials.secret === "string" ? credentials.secret : "";
        const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
        if (!expected || !provided || !email) return null;

        const expectedBytes = Buffer.from(expected);
        const providedBytes = Buffer.from(provided);
        if (
          expectedBytes.length !== providedBytes.length ||
          !timingSafeEqual(expectedBytes, providedBytes)
        ) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!isAuthorizedTestFixture(user)) return null;
        return user;
      },
    })
  );
}

if (providers.length === 0 && process.env.NODE_ENV !== "test") {
  console.warn("Auth.js has no provider configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") return isVerifiedGoogleProfile(profile);
      if (account?.provider === "test-fixture") return testAuthEnabled;
      return false;
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      session.authenticatedAt = typeof token.iat === "number" ? token.iat : 0;
      return session;
    },
  },
});
