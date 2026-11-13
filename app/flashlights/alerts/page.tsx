import { connection } from "next/server";
import { Suspense } from "react";
import { AlertsHub } from "@lp/components/alerts/alerts-hub";
import { PageSkeleton } from "@lp/components/skeletons";
import { vapidPublicKey } from "@lp/lib/env";
import { describeFilterChips, describeFilters, filtersToParams, parseFilters } from "@lp/lib/filters";
import { getAlertRules, getMatchHistory, getNotificationSettings } from "@lp/lib/queries";
import { getUserId } from "@lp/lib/user";

export const metadata = { title: "BeamAlerts" };

export default function AlertsPage({ searchParams }: PageProps<"/flashlights/alerts">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AlertsBody searchParams={searchParams} />
    </Suspense>
  );
}

async function AlertsBody({ searchParams }: { searchParams: PageProps<"/flashlights/alerts">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const uid = await getUserId();
  if (!uid) {
    return <p className="mx-auto max-w-xl px-4 py-16 text-center text-muted-foreground">Enable cookies to save alert rules on this device.</p>;
  }
  const [settings, rules, history] = await Promise.all([getNotificationSettings(uid), getAlertRules(uid), getMatchHistory(uid, 60)]);
  const draftFilters = parseFilters(sp);
  const draft =
    sp.new === "1"
      ? { query: filtersToParams(draftFilters).toString(), chips: describeFilterChips(draftFilters), name: describeFilters(draftFilters) }
      : null;

  return <AlertsHub settings={settings} rules={rules} history={history} draft={draft} vapidPublicKey={vapidPublicKey()} />;
}
