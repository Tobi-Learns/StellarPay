import { redirect } from "next/navigation";
import { getAuthenticatedUser, getPlatformContext } from "@/lib/auth-session";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/signin?callbackUrl=/onboarding");
  const context = await getPlatformContext();
  if (context?.business.wallets.some((wallet) => wallet.isDefault)) redirect("/app");
  return (
    <OnboardingClient
      initialBusiness={context ? { id: context.business.id, name: context.business.name } : null}
      suggestedName={user.name ?? user.email?.split("@")[0] ?? "My business"}
    />
  );
}
