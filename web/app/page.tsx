import { MockupApp } from "@/components/app/MockupApp";
import { getForge } from "@/lib/db/queries/forge";
import { getPitch } from "@/lib/db/queries/pitch";
import { getPulse } from "@/lib/db/queries/pulse";
import { buildMockupData } from "@/lib/mockup";

// Curated tables change out-of-band via the worker; always render fresh.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [pulse, forge, pitch] = await Promise.all([getPulse(), getForge(), getPitch()]);
  return <MockupApp data={buildMockupData(pulse, forge, pitch)} />;
}
