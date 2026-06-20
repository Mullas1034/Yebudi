import type { MorningReadiness } from "@/lib/types";

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export interface Band {
  label: string;
  ring: string; // text-* color for the SVG progress stroke
  text: string; // text-* color for labels
}

export function readinessBand(score: number | null): Band {
  if (score == null) return { label: "No data", ring: "text-zinc-600", text: "text-zinc-400" };
  if (score >= 80) return { label: "Primed", ring: "text-emerald-400", text: "text-emerald-400" };
  if (score >= 60) return { label: "Ready", ring: "text-lime-400", text: "text-lime-400" };
  if (score >= 40) return { label: "Moderate", ring: "text-amber-400", text: "text-amber-400" };
  return { label: "Take it easy", ring: "text-rose-400", text: "text-rose-400" };
}

export interface HrvMeta {
  label: string;
  text: string;
  badge: string; // border + bg + text classes for the pill
}

export function hrvStatusMeta(status: string | null): HrvMeta {
  switch (status) {
    case "balanced":
      return {
        label: "Balanced",
        text: "text-emerald-400",
        badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "unbalanced":
      return {
        label: "Unbalanced",
        text: "text-amber-400",
        badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    case "low":
    case "poor":
      return {
        label: status === "low" ? "Low" : "Poor",
        text: "text-rose-400",
        badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    default:
      return {
        label: "No reading",
        text: "text-zinc-400",
        badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
      };
  }
}

/** One-line, glanceable summary derived from the day's scores. */
export function deriveReadinessInsight(d: MorningReadiness): string {
  const lead: string[] = [];
  const r = d.readinessScore;
  if (r == null) return "Not enough data yet — sync your watch to see today's readiness.";
  if (r >= 80) lead.push("You're well recovered and ready to train hard");
  else if (r >= 60) lead.push("You're set for a solid session");
  else if (r >= 40) lead.push("Recovery is moderate — keep the intensity in check");
  else lead.push("Your body is asking for recovery today");

  const support: string[] = [];
  if (d.hrvStatus === "balanced") support.push("HRV is balanced");
  else if (d.hrvStatus === "unbalanced" || d.hrvStatus === "low" || d.hrvStatus === "poor")
    support.push("HRV is below your baseline");
  if (d.sleepScore != null && d.sleepScore < 60) support.push("sleep was light");
  else if (d.sleepScore != null && d.sleepScore >= 80) support.push("you slept well");

  return support.length ? `${lead[0]}. ${cap(support.join(", "))}.` : `${lead[0]}.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
