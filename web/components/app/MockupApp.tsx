"use client";

import { useEffect } from "react";

// Verbatim mockup script, shipped as untyped JS (allowJs) for 1:1 fidelity.
import { runMockup } from "@/components/app/mockup-runtime";
import { SHELL_HTML } from "@/components/app/mockup-shell";
import type { MockupData } from "@/lib/pulse-mockup";

// Renders the mockup's static shell once, then runs its own rendering engine against it,
// injecting real Pulse data. React never re-renders the shell — the script owns it.
export function MockupApp({ data }: { data: MockupData }) {
  useEffect(() => {
    const cleanup = runMockup(data);
    return typeof cleanup === "function" ? cleanup : undefined;
  }, [data]);

  return <div dangerouslySetInnerHTML={{ __html: SHELL_HTML }} />;
}
