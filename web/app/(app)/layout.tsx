"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ModeTabs } from "@/components/app/ModeTabs";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const mode = pathname.startsWith("/forge") ? "forge" : pathname.startsWith("/pitch") ? "pitch" : "pulse";

  return (
    <div className="screen" data-mode={mode}>
      <div className="scroll">{children}</div>
      <ModeTabs />
    </div>
  );
}
