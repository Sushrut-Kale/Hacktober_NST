"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-slate-400 font-mono text-xs">
      Redirecting to VIKASA Dashboard...
    </div>
  );
}
