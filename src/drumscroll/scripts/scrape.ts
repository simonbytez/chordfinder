import { SCRAPER_ADAPTERS } from "../server/scraper/adapters";
import { runScraperAdapter } from "../server/scraper/engine";

async function main() {
  const target = process.argv[2]?.trim();
  const ids = target ? [target] : Object.keys(SCRAPER_ADAPTERS);

  for (const id of ids) {
    console.log(`[drumscroll] Running scraper adapter: ${id}...`);
    const report = await runScraperAdapter(id);
    console.log(
      `[drumscroll] ${id} -> status=${report.source.lastStatus} added=${report.added} updated=${report.updated} total=${report.source.itemCount} | ${report.message}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[drumscroll] Scrape CLI failed:", err);
  process.exit(1);
});
