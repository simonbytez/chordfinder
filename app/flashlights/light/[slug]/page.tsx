import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LightDetail } from "@lp/components/light/light-detail";
import { RelativeTime } from "@lp/components/relative-time";
import { PageSkeleton } from "@lp/components/skeletons";
import { getLightBySlug, getMentions } from "@lp/lib/queries";
import { getUserId } from "@lp/lib/user";

export default function LightPage({ params }: PageProps<"/flashlights/light/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LightBody params={params} />
    </Suspense>
  );
}

async function LightBody({ params }: { params: PageProps<"/flashlights/light/[slug]">["params"] }) {
  await connection();
  const { slug } = await params;
  const uid = await getUserId();
  const light = await getLightBySlug(decodeURIComponent(slug), uid);
  if (!light) notFound();
  const mentions = await getMentions(12, light.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/flashlights?mode=vault" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber">
        <ArrowLeft className="size-4" /> Catalog
      </Link>
      <h1 className="mb-5 text-3xl font-semibold tracking-tight">
        <span className="text-muted-foreground">{light.brand}</span> {light.modelName}
      </h1>
      <LightDetail
        light={light}
        mentions={
          mentions.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Community buzz</h3>
              <ul className="space-y-2">
                {mentions.map((m) => (
                  <li key={m.id}>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-amber/40">
                      <span className="group-hover:text-amber">
                        {m.flair && <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-amber">{m.flair}</span>}
                        {m.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <RelativeTime iso={m.publishedAt} />
                        <ExternalLink className="size-3" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )
        }
      />
    </div>
  );
}
