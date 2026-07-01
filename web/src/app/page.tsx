"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";

export default function Home() {
  const { address } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (address) {
      router.replace("/app");
    } else {
      router.replace("/connect");
    }
  }, [address, router]);

  return null;
}
