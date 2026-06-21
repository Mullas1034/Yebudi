import { PulseDashboard } from "@/components/app/PulseDashboard";
import { getPulse } from "@/lib/db/queries/pulse";

// Always render fresh data; the curated tables change out-of-band via the worker.
export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const data = await getPulse();
  return <PulseDashboard data={data} />;
}
