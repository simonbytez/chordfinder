"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  createManualTranscriptionApi,
  fetchScraperSources,
  triggerScraperRun,
} from "../lib/api";
import {
  CATEGORIES,
  type Category,
  DIFFICULTIES,
  type Difficulty,
  INSTRUMENTS,
  type Instrument,
  type ScraperSourceInfo,
} from "../lib/constants";

interface ScraperDrawerProps {
  open: boolean;
  onClose: () => void;
  onCatalogUpdated: () => void;
}

export function ScraperDrawer({
  open,
  onClose,
  onCatalogUpdated,
}: ScraperDrawerProps) {
  const [sources, setSources] = useState<ScraperSourceInfo[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runMessages, setRunMessages] = useState<Record<string, string>>({});

  // Manual single-PDF add state
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualInstrument, setManualInstrument] = useState<Instrument>("Snare");
  const [manualCategory, setManualCategory] = useState<Category>("DCI");
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty | "Auto">("Auto");
  const [manualPdfUrl, setManualPdfUrl] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingSources(true);
    fetchScraperSources()
      .then((res) => setSources(res.sources))
      .catch((err) => console.error("[drumscroll] sources fetch failed:", err))
      .finally(() => setLoadingSources(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleRunAdapter(id: string) {
    if (runningId) return;
    setRunningId(id);
    setRunMessages((prev) => ({ ...prev, [id]: "Checking robots.txt & scraping politely…" }));
    try {
      const report = await triggerScraperRun(id);
      if (report.source) {
        setSources((prev) =>
          prev.map((s) => (s.id === id ? report.source! : s)),
        );
      }
      setRunMessages((prev) => ({
        ...prev,
        [id]: report.message ?? `Added ${report.added} new sheets.`,
      }));
      if (report.added > 0 || report.updated > 0) {
        onCatalogUpdated();
      }
    } catch (err) {
      setRunMessages((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Scrape failed.",
      }));
    } finally {
      setRunningId(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim() || !manualPdfUrl.trim() || addingManual) return;
    setAddingManual(true);
    setManualFeedback(null);
    try {
      const { item } = await createManualTranscriptionApi({
        title: manualTitle.trim(),
        artistOrCorps: manualArtist.trim() || undefined,
        instrument: manualInstrument,
        category: manualCategory,
        difficulty: manualDifficulty === "Auto" ? undefined : manualDifficulty,
        pdfUrl: manualPdfUrl.trim(),
      });
      setManualTitle("");
      setManualArtist("");
      setManualPdfUrl("");
      setManualFeedback(
        `Added "${item.title}" (${item.difficulty}) to DrumScroll.`,
      );
      onCatalogUpdated();
    } catch (err) {
      setManualFeedback(
        err instanceof Error ? err.message : "Failed to add sheet.",
      );
    } finally {
      setAddingManual(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                Sheet Music Scrapers
              </h2>
              <p className="text-xs text-zinc-400">
                Modular adapters · Polite rate-limiting · Auto-difficulty tagger
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Polite Scraping Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Adapters honor <code className="text-emerald-300">robots.txt</code>, pause
              1–2s between requests, skip paid Gumroad/store links, and run inside a 44s
              Vercel-safe budget.
            </span>
          </div>

          {/* Adapter Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Site Adapters
            </h3>

            {loadingSources ? (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-400 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                <span>Loading adapters…</span>
              </div>
            ) : (
              sources.map((src) => {
                const isRunning = runningId === src.id;
                const statusMsg = runMessages[src.id] || src.lastError;
                return (
                  <div
                    key={src.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-zinc-100">
                            {src.name}
                          </h4>
                          <a
                            href={src.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300"
                            title={src.baseUrl}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {src.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(runningId)}
                        onClick={() => handleRunAdapter(src.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-default"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Scraping…</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Scrape</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 pt-1">
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300">
                        {src.instrument} · {src.defaultCategory}
                      </span>
                      <span>{src.itemCount} indexed</span>
                      {src.lastRunAt && (
                        <span>
                          · Last run{" "}
                          {new Date(src.lastRunAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {src.lastStatus === "ok" && (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> ok
                        </span>
                      )}
                      {src.lastStatus === "error" && (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <AlertCircle className="h-3 w-3" /> blocked/error
                        </span>
                      )}
                    </div>

                    {statusMsg && (
                      <p
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          src.lastStatus === "error" && !isRunning
                            ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            : "bg-zinc-950/80 text-zinc-300 border border-zinc-800/80"
                        }`}
                      >
                        {statusMsg}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Manual Single Sheet URL Adder */}
          <form
            onSubmit={handleManualSubmit}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Plus className="h-3.5 w-3.5 text-amber-400" />
              <span>Add Free PDF or Google Drive Link</span>
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                required
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Title (e.g. 2024 Opener Snare Break)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
              />
              <input
                type="text"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                placeholder="Corps or Drummer (e.g. Bluecoats, Elvin Jones)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
              />
              <input
                type="url"
                required
                value={manualPdfUrl}
                onChange={(e) => setManualPdfUrl(e.target.value)}
                placeholder="https://... (.pdf or Google Drive share URL)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
              />

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={manualInstrument}
                  onChange={(e) => setManualInstrument(e.target.value as Instrument)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-200"
                >
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>

                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as Category)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-200"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={manualDifficulty}
                  onChange={(e) =>
                    setManualDifficulty(e.target.value as Difficulty | "Auto")
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-200"
                >
                  <option value="Auto">Auto-Tag</option>
                  {DIFFICULTIES.map((diff) => (
                    <option key={diff} value={diff}>
                      {diff}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {manualFeedback && (
              <p className="text-xs text-amber-300">{manualFeedback}</p>
            )}

            <button
              type="submit"
              disabled={addingManual}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {addingManual ? "Indexing Sheet…" : "Add to DrumScroll"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
