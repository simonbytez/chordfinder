import { connection } from "next/server";
import { Suspense } from "react";
import { DrumScrollApp } from "@ds/components/DrumScrollApp";
import { listTranscriptions } from "@ds/server/queries";

async function DrumScrollLoader() {
  await connection();
  const initialData = await listTranscriptions({ limit: 40, offset: 0 });
  return <DrumScrollApp initialData={initialData} />;
}

export default function DrumScrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-sm text-zinc-400">
          Loading DrumScroll…
        </div>
      }
    >
      <DrumScrollLoader />
    </Suspense>
  );
}
