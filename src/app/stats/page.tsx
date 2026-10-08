"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui";

// The juz statistics now live on the "Qrup" screen
export default function StatsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/progress");
  }, [router]);
  return <LoadingScreen />;
}
