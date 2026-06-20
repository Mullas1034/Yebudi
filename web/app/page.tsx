import { ReadinessDashboard } from "@/components/readiness/readiness-dashboard";
import { getMorningReadiness } from "@/lib/mock-data";

export default function Page() {
  // TODO: replace mock with a query against curated.daily_summary (+ sleep_session).
  const data = getMorningReadiness();
  return <ReadinessDashboard data={data} />;
}
