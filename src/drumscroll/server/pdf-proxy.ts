import { NextResponse, type NextRequest } from "next/server";
import { extractGoogleDriveFileId } from "../lib/constants";
import { DRUMSCROLL_USER_AGENT } from "./scraper/robots";

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB safety cap

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  // Block IPv4 loopback, private RFC1918, and cloud metadata ranges
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  const m172 = h.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }

  // Block IPv6 ULA / link-local
  if (/^(?:fc|fd|fe80):/i.test(h)) return true;

  return false;
}

export async function handlePdfProxy(req: NextRequest): Promise<NextResponse> {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing `url` query parameter." }, { status: 400 });
  }

  // Convert Google Drive share links into direct download endpoints
  const driveId = extractGoogleDriveFileId(rawUrl);
  const fetchTarget = driveId
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`
    : rawUrl;

  let parsed: URL;
  try {
    parsed = new URL(fetchTarget);
  } catch {
    return NextResponse.json({ error: "Invalid PDF URL." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are supported." }, { status: 400 });
  }

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked target host." }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": DRUMSCROLL_USER_AGENT,
        Accept: "application/pdf,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      await upstream.body?.cancel();
      return NextResponse.json(
        { error: `Upstream PDF returned HTTP ${upstream.status}.` },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const finalUrl = new URL(upstream.url);
    if (isBlockedHost(finalUrl.hostname)) {
      await upstream.body?.cancel();
      return NextResponse.json({ error: "Blocked redirect target." }, { status: 403 });
    }

    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (contentLength > MAX_PDF_BYTES) {
      await upstream.body?.cancel();
      return NextResponse.json({ error: "PDF exceeds 25 MB proxy limit." }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF exceeds 25 MB proxy limit." }, { status: 413 });
    }

    // Verify %PDF- magic bytes so HTML error pages aren't served as broken PDFs
    const headerBytes = new Uint8Array(buffer.slice(0, 8));
    const headerAscii = String.fromCharCode(...headerBytes);
    if (!headerAscii.includes("%PDF-")) {
      return NextResponse.json(
        { error: "Target URL did not return a valid PDF document." },
        { status: 415 },
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch PDF.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
