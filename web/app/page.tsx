import { MockupApp } from "@/components/app/MockupApp";
import { getPulse } from "@/lib/db/queries/pulse";
import { toMockupPulse } from "@/lib/pulse-mockup";

// Curated tables change out-of-band via the worker; always render fresh.
export const dynamic = "force-dynamic";

export default async function Page() {
  const pulse = await getPulse();
  return <MockupApp data={toMockupPulse(pulse)} />;
}
