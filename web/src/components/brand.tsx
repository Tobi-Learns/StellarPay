import Link from "next/link";

type BrandTone = "dark" | "light";

const toneClasses = {
  dark: {
    mark: "bg-[var(--sp-ink)] text-[var(--sp-mint)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
    word: "text-[var(--sp-ink)]",
    descriptor: "text-[var(--sp-muted)]",
  },
  light: {
    mark: "bg-[var(--sp-mint)] text-[var(--sp-ink)] shadow-[inset_0_0_0_1px_rgba(7,19,17,0.08)]",
    word: "text-white",
    descriptor: "text-white/68",
  },
};

export function BrandMark({ tone = "dark", className = "" }: { tone?: BrandTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] ${toneClasses[tone].mark} ${className}`}
    >
      <span className="absolute left-2 top-2 size-1.5 rounded-full bg-[var(--sp-teal)]" />
      <span className="absolute right-2 top-1.5 h-6 w-px rotate-45 rounded-full bg-current/28" />
      <span className="text-[15px] font-black leading-none tracking-normal">S</span>
    </span>
  );
}

export function BrandLogo({
  href = "/",
  tone = "dark",
  showDescriptor = false,
  className = "",
}: {
  href?: string;
  tone?: BrandTone;
  showDescriptor?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <BrandMark tone={tone} />
      <span className="flex flex-col leading-none">
        <span className={`text-base font-bold tracking-normal ${toneClasses[tone].word}`}>StellarPay</span>
        {showDescriptor && (
          <span className={`mt-1 text-[11px] font-medium tracking-normal ${toneClasses[tone].descriptor}`}>
            Wallet-native payments
          </span>
        )}
      </span>
    </>
  );

  if (!href) {
    return <span className={`inline-flex items-center gap-2.5 ${className}`}>{content}</span>;
  }

  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="sr-only">StellarPay home</span>
      {content}
    </Link>
  );
}
