import type { ForgeData } from "@/lib/db/queries/forge";
import type { PitchData } from "@/lib/db/queries/pitch";
import { toMockupForge } from "@/lib/forge-mockup";
import { toMockupPitch } from "@/lib/pitch-mockup";
import { toMockupPulse } from "@/lib/pulse-mockup";
import type { PulseData } from "@/lib/pulse-types";

// The full payload handed to the mockup runtime: one object per mode + hero factors and
// the Pitch GPS map. Loosely typed because it feeds the verbatim (untyped) mockup engine.
export interface MockupData {
  pulse: unknown;
  forge: unknown;
  pitch: unknown;
  heroFactors: { pulse: unknown; forge: unknown; pitch: unknown };
  pitchMap: unknown;
}

export function buildMockupData(pulse: PulseData, forge: ForgeData, pitch: PitchData): MockupData {
  const P = toMockupPulse(pulse);
  const F = toMockupForge(forge);
  const Pi = toMockupPitch(pitch);
  return {
    pulse: P.pulse,
    forge: F.forge,
    pitch: Pi.pitch,
    heroFactors: { pulse: P.heroFactors, forge: F.heroFactors, pitch: Pi.heroFactors },
    pitchMap: Pi.pitchMap,
  };
}
