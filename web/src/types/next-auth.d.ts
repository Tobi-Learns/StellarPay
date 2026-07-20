import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    authenticatedAt: number;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
