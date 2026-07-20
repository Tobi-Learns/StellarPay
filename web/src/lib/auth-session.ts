import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isActivePlatformSession } from "@/lib/auth-policy";

export type PlatformContext = Awaited<ReturnType<typeof loadPlatformContext>>;

async function loadPlatformContext(userId: string) {
  const membership = await db.membership.findFirst({
    where: { userId, role: "owner" },
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
      business: {
        include: {
          wallets: { orderBy: [{ isDefault: "desc" }, { verifiedAt: "asc" }] },
        },
      },
    },
  });
  return membership;
}

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!isActivePlatformSession(session, new Date()) || !session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

export async function getPlatformContext() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  return loadPlatformContext(user.id);
}

export async function getRequiredPlatformContext() {
  const context = await getPlatformContext();
  if (!context) throw new Error("UNAUTHORIZED");
  return context;
}
