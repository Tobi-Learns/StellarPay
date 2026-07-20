import { redirect } from "next/navigation";
import { getAuthenticatedUser, getPlatformContext } from "@/lib/auth-session";
import { PlatformShell } from "@/components/platform-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/signin?callbackUrl=/app");

  const context = await getPlatformContext();
  if (!context) redirect("/onboarding");

  return <PlatformShell>{children}</PlatformShell>;
}
