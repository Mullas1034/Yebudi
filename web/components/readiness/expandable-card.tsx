"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  icon?: React.ReactNode;
  accentClass?: string; // background for the icon chip
  title: string;
  value: React.ReactNode;
  unit?: string;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode; // drill-down detail
}

// Progressive disclosure: a glanceable header that taps open to reveal detail.
// Uses a grid-rows 0fr→1fr transition so the reveal animates without measuring height.
export function ExpandableCard({
  icon,
  accentClass,
  title,
  value,
  unit,
  caption,
  badge,
  defaultOpen = false,
  children,
}: ExpandableCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const panelId = React.useId();

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-white/[0.03]"
      >
        {icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              accentClass,
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            {badge}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {caption && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t px-4 py-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}
