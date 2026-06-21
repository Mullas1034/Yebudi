"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ForgeIcon, PitchIcon, PulseIcon } from "@/components/app/icons";

const TABS = [
  { mode: "pulse", label: "Pulse", href: "/pulse", Icon: PulseIcon },
  { mode: "forge", label: "Forge", href: "/forge", Icon: ForgeIcon },
  { mode: "pitch", label: "Pitch", href: "/pitch", Icon: PitchIcon },
] as const;

export function ModeTabs() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map(({ mode, label, href, Icon }) => (
        <Link key={mode} href={href} className={`tab${pathname?.startsWith(href) ? " active" : ""}`} aria-label={label}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
