import type { ScraperAdapter } from "../types";
import { drumlineSheetsAdapter } from "./drumlinesheets";
import { francisAdapter } from "./francis";
import { lothypeAdapter } from "./lothype";
import { onJazzDrummingAdapter } from "./onjazzdrumming";

export const SCRAPER_ADAPTERS: Record<string, ScraperAdapter> = {
  [lothypeAdapter.id]: lothypeAdapter,
  [drumlineSheetsAdapter.id]: drumlineSheetsAdapter,
  [onJazzDrummingAdapter.id]: onJazzDrummingAdapter,
  [francisAdapter.id]: francisAdapter,
};

export function getScraperAdapter(id: string): ScraperAdapter | undefined {
  return SCRAPER_ADAPTERS[id];
}
