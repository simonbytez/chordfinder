import { NextResponse, type NextRequest } from "next/server";
import { isCategory, isDifficulty, isInstrument } from "../lib/constants";
import { databaseMissing, getDbKind } from "./db";
import { handlePdfProxy } from "./pdf-proxy";
import {
  getTranscriptionById,
  listScraperSources,
  listTranscriptions,
  patchTranscription,
  upsertTranscription,
} from "./queries";
import { runScraperAdapter } from "./scraper/engine";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function handleDrumScrollApi(
  req: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const [resource, second, third] = segments;
  const method = req.method.toUpperCase();

  // Edge-cached CORS proxy for external PDFs (does not require DB)
  if (resource === "pdf" && method === "GET") {
    return handlePdfProxy(req);
  }

  if (databaseMissing()) {
    return jsonError(
      "DrumScroll has no database configured on Vercel yet. Connect a Postgres database (DATABASE_URL) in Vercel Storage and redeploy.",
      503,
    );
  }

  try {
    // GET /api/drumscroll/health
    if ((resource === "health" || !resource) && method === "GET") {
      const dbKind = await getDbKind();
      return NextResponse.json({ ok: true, dbKind });
    }

    // /api/drumscroll/transcriptions
    if (resource === "transcriptions") {
      // Collection routes: GET / POST /api/drumscroll/transcriptions
      if (!second) {
        if (method === "GET") {
          const sp = req.nextUrl.searchParams;
          const bookmarkedParam = sp.get("bookmarked");
          const result = await listTranscriptions({
            q: sp.get("q") ?? undefined,
            instrument: sp.get("instrument") ?? undefined,
            category: sp.get("category") ?? undefined,
            difficulty: sp.get("difficulty") ?? undefined,
            bookmarked: bookmarkedParam === "true" || bookmarkedParam === "1",
            sourceSite: sp.get("sourceSite") ?? undefined,
            limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
            offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
            sort: sp.get("sort") === "title" ? "title" : "newest",
          });
          return NextResponse.json(result);
        }

        if (method === "POST") {
          const body = await safeJson(req);
          const title = typeof body.title === "string" ? body.title.trim() : "";
          const pdfUrl = typeof body.pdfUrl === "string" ? body.pdfUrl.trim() : "";
          if (!title) return jsonError("`title` is required.", 400);
          if (!pdfUrl || !/^https?:\/\//i.test(pdfUrl)) {
            return jsonError("A valid `pdfUrl` (http/https) is required.", 400);
          }

          const sourceUrl =
            typeof body.sourceUrl === "string" && /^https?:\/\//i.test(body.sourceUrl.trim())
              ? body.sourceUrl.trim()
              : pdfUrl;

          const { item, created } = await upsertTranscription({
            title,
            artistOrCorps: typeof body.artistOrCorps === "string" ? body.artistOrCorps : undefined,
            instrument: isInstrument(body.instrument) ? body.instrument : undefined,
            category: isCategory(body.category) ? body.category : undefined,
            difficulty: isDifficulty(body.difficulty) ? body.difficulty : undefined,
            difficultyOverridden: isDifficulty(body.difficulty),
            pageCount: typeof body.pageCount === "number" ? body.pageCount : undefined,
            sourceUrl,
            pdfUrl,
            previewImageUrl: typeof body.previewImageUrl === "string" ? body.previewImageUrl : undefined,
            sourceSite: typeof body.sourceSite === "string" ? body.sourceSite : "manual",
          });

          return NextResponse.json({ item, created }, { status: created ? 201 : 200 });
        }

        return jsonError(`Method ${method} not allowed.`, 405);
      }

      // Item routes: /api/drumscroll/transcriptions/:id[/bookmark|/difficulty]
      const id = Number(second);
      if (!Number.isInteger(id) || id <= 0) {
        return jsonError("Invalid transcription ID.", 400);
      }

      if (!third && method === "GET") {
        const item = await getTranscriptionById(id);
        if (!item) return jsonError("Transcription not found.", 404);
        return NextResponse.json({ item });
      }

      if (method === "PATCH") {
        const body = await safeJson(req);

        // Support dedicated sub-routes (/bookmark, /difficulty) as well as unified PATCH /:id
        if (third === "bookmark") {
          const current = await getTranscriptionById(id);
          if (!current) return jsonError("Transcription not found.", 404);
          const nextBookmarked =
            typeof body.bookmarked === "boolean" ? body.bookmarked : !current.bookmarked;
          const updated = await patchTranscription(id, { bookmarked: nextBookmarked });
          return NextResponse.json({ item: updated });
        }

        if (third === "difficulty") {
          if (body.reset === true) {
            const updated = await patchTranscription(id, { resetDifficultyOverride: true });
            if (!updated) return jsonError("Transcription not found.", 404);
            return NextResponse.json({ item: updated });
          }
          if (!isDifficulty(body.difficulty)) {
            return jsonError(
              "Valid `difficulty` is required (Beginner, Intermediate, Advanced, World Class/Pro).",
              400,
            );
          }
          const updated = await patchTranscription(id, { difficulty: body.difficulty });
          if (!updated) return jsonError("Transcription not found.", 404);
          return NextResponse.json({ item: updated });
        }

        if (!third) {
          if (body.difficulty !== undefined && !isDifficulty(body.difficulty)) {
            return jsonError(
              "Invalid `difficulty`. Expected Beginner, Intermediate, Advanced, or World Class/Pro.",
              400,
            );
          }
          const updated = await patchTranscription(id, {
            bookmarked: typeof body.bookmarked === "boolean" ? body.bookmarked : undefined,
            difficulty: isDifficulty(body.difficulty) ? body.difficulty : undefined,
            resetDifficultyOverride: body.resetDifficultyOverride === true,
            previewImageUrl:
              body.previewImageUrl === null || typeof body.previewImageUrl === "string"
                ? body.previewImageUrl
                : undefined,
            pageCount: typeof body.pageCount === "number" ? body.pageCount : undefined,
            title: typeof body.title === "string" ? body.title : undefined,
            artistOrCorps: typeof body.artistOrCorps === "string" ? body.artistOrCorps : undefined,
            instrument: isInstrument(body.instrument) ? body.instrument : undefined,
            category: isCategory(body.category) ? body.category : undefined,
          });
          if (!updated) return jsonError("Transcription not found.", 404);
          return NextResponse.json({ item: updated });
        }
      }

      return jsonError("Not found.", 404);
    }

    // /api/drumscroll/scrapers
    if (resource === "scrapers") {
      if (!second && method === "GET") {
        const sources = await listScraperSources();
        return NextResponse.json({ sources });
      }
      if (!second && method === "POST") {
        const body = await safeJson(req);
        const adapterId = typeof body.adapterId === "string" ? body.adapterId.trim() : "";
        if (!adapterId) return jsonError("`adapterId` is required.", 400);
        const report = await runScraperAdapter(adapterId);
        return NextResponse.json(report, { status: report.ok ? 200 : 502 });
      }
      if (second && (third === "run" || !third) && method === "POST") {
        const report = await runScraperAdapter(second);
        return NextResponse.json(report, { status: report.ok ? 200 : 502 });
      }
      return jsonError("Not found.", 404);
    }

    return jsonError("Not found.", 404);
  } catch (err) {
    console.error("[drumscroll api]", err);
    const message = err instanceof Error ? err.message : "Internal server error.";
    return jsonError(message, 500);
  }
}
