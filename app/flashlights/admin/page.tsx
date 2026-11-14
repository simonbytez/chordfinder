import { connection } from "next/server";
import { Suspense } from "react";
import { AdminPanel } from "@lp/components/admin/admin-panel";
import { PageSkeleton } from "@lp/components/skeletons";
import { usingPostgres } from "@lp/db";
import { appUrl } from "@lp/lib/env";
import { llmProvider } from "@lp/lib/ingestion/extract/llm";
import { getAdminLightIndex, getLightBySlug, getRecentEvents, getSourcesWithStats } from "@lp/lib/queries";

export const metadata = { title: "Ingestion" };

export default function AdminPage({ searchParams }: PageProps<"/flashlights/admin">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminBody searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminBody({ searchParams }: { searchParams: PageProps<"/flashlights/admin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const editSlug = typeof sp.edit === "string" ? sp.edit : null;
  const [sources, events, lights, editing] = await Promise.all([
    getSourcesWithStats(),
    getRecentEvents(30),
    getAdminLightIndex(),
    editSlug ? getLightBySlug(editSlug, null) : Promise.resolve(null),
  ]);
  return (
    <AdminPanel
      sources={sources}
      events={events}
      lights={lights}
      editing={editing}
      env={{
        database: usingPostgres() ? "PostgreSQL" : "Embedded PGlite (.data/lumenpulse)",
        llm: llmProvider() ?? "none (regex parser)",
        cronSecret: !!process.env.CRON_SECRET,
        adminPassword: !!process.env.LUMENPULSE_ADMIN_PASSWORD,
        appUrl: appUrl(),
      }}
    />
  );
}
