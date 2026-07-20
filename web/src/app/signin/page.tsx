import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { BrandLogo } from "@/components/brand";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (user) redirect("/app");
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/app";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[var(--sp-paper)] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--sp-border)] bg-white p-8 shadow-[0_18px_60px_rgba(7,19,17,0.08)]">
        <BrandLogo href="/" showDescriptor />
        <h1 className="mt-8 text-2xl font-semibold text-[var(--sp-ink)]">Sign in to the Platform</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sp-muted)]">
          Your Google account secures the Business dashboard. Settlement wallets stay separate and self-custodied.
        </p>
        {params.error && (
          <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Google sign-in did not complete. Please try again.</p>
        )}
        <form
          className="mt-7"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button className="w-full rounded-xl bg-[var(--sp-ink)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--sp-green)]">
            Continue with Google
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-[var(--sp-muted)]/80">
          StellarPay never creates or stores a settlement-wallet private key when you sign in.
        </p>
      </div>
    </div>
  );
}
