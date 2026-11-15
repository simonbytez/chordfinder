import type { Category, Difficulty, Instrument } from "../lib/constants";
import type { Database } from "./db";
import { drumscrollSources, drumscrollTranscriptions, type NewSourceRow } from "./schema";
import { estimateDifficulty } from "./tagger";
import { count } from "drizzle-orm";

export const STARTER_SOURCES: NewSourceRow[] = [
  {
    id: "lothype",
    name: "LotHype",
    baseUrl: "https://www.lothype.com",
    instrument: "Snare",
    defaultCategory: "DCI",
    description: "Free DCI & WGI snare drum warmups, exercises, and show transcriptions.",
    lastStatus: "idle",
    itemCount: 0,
  },
  {
    id: "drumlinesheets",
    name: "r/DrumlineSheets",
    baseUrl: "https://www.reddit.com/r/DrumlineSheets",
    instrument: "Snare",
    defaultCategory: "DCI",
    description: "Community-curated DCI, WGI, and rudimental marching snare transcriptions.",
    lastStatus: "idle",
    itemCount: 0,
  },
  {
    id: "onjazzdrumming",
    name: "OnJazzDrumming",
    baseUrl: "https://www.onjazzdrumming.com",
    instrument: "Drumset",
    defaultCategory: "Jazz",
    description: "Transcriptions of legendary jazz drumset solos, comping, and phrasings.",
    lastStatus: "idle",
    itemCount: 0,
  },
  {
    id: "francis",
    name: "Francis' Drumming Blog",
    baseUrl: "https://francisdrummingblog.com",
    instrument: "Drumset",
    defaultCategory: "Rock/Funk",
    description: "Free funk, rock, fusion, and jazz drumset grooves & full chart PDFs.",
    lastStatus: "idle",
    itemCount: 0,
  },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates a crisp engraved percussion sheet-music SVG preview (8.5x11 aspect)
 * so starter seed entries render realistic notation previews out of the box.
 */
export function buildEngravedSheetSvgDataUrl(opts: {
  title: string;
  artistOrCorps: string;
  instrument: Instrument;
  category: Category;
  timeSig?: [number, number];
  tempo?: number;
  sticking?: string[];
  density?: "sparse" | "medium" | "dense";
}): string {
  const [topSig, botSig] = opts.timeSig ?? [4, 4];
  const tempo = opts.tempo ?? 132;
  const density = opts.density ?? "medium";
  const sticking = opts.sticking ?? (opts.instrument === "Snare" ? ["R", "L", "R", "R", "L", "R", "L", "L"] : []);

  const staves: string[] = [];
  const staffYs = [180, 305, 430, 555, 680];
  const noteCountPerBar = density === "sparse" ? 4 : density === "dense" ? 8 : 6;

  staffYs.forEach((baseY, staffIdx) => {
    // 5 staff lines
    for (let l = 0; l < 5; l++) {
      const y = baseY + l * 9;
      staves.push(`<line x1="56" y1="${y}" x2="544" y2="${y}" stroke="#27272a" stroke-width="1"/>`);
    }
    // Left, middle, right barlines
    staves.push(`<line x1="56" y1="${baseY}" x2="56" y2="${baseY + 36}" stroke="#18181b" stroke-width="1.6"/>`);
    staves.push(`<line x1="312" y1="${baseY}" x2="312" y2="${baseY + 36}" stroke="#27272a" stroke-width="1.2"/>`);
    staves.push(`<line x1="544" y1="${baseY}" x2="544" y2="${baseY + 36}" stroke="#18181b" stroke-width="1.6"/>`);

    // Percussion clef on each staff
    staves.push(`<rect x="66" y="${baseY + 9}" width="3" height="18" fill="#18181b"/>`);
    staves.push(`<rect x="73" y="${baseY + 9}" width="3" height="18" fill="#18181b"/>`);

    // Time signature on first staff
    let startX = 94;
    if (staffIdx === 0) {
      staves.push(
        `<text x="90" y="${baseY + 16}" font-family="Georgia, serif" font-size="19" font-weight="700" fill="#18181b" text-anchor="middle">${topSig}</text>`,
      );
      staves.push(
        `<text x="90" y="${baseY + 34}" font-family="Georgia, serif" font-size="19" font-weight="700" fill="#18181b" text-anchor="middle">${botSig}</text>`,
      );
      startX = 112;
    }

    // Two measures per system
    const bars = [
      { x0: startX, x1: 300 },
      { x0: 326, x1: 530 },
    ];

    bars.forEach((bar, barIdx) => {
      const span = bar.x1 - bar.x0;
      const step = span / noteCountPerBar;
      const stemTopY = baseY - 12;

      for (let n = 0; n < noteCountPerBar; n++) {
        const cx = Math.round(bar.x0 + n * step + 10);
        const seed = (staffIdx * 17 + barIdx * 11 + n * 7) % 10;
        const isSnareOnly = opts.instrument === "Snare";
        const cy = isSnareOnly
          ? baseY + 18
          : seed < 3
            ? baseY + 31 // Kick space
            : seed < 6
              ? baseY + 18 // Snare space
              : baseY + 4; // Ride / Hi-hat top line

        // Cymbal X notehead vs oval notehead
        if (!isSnareOnly && cy === baseY + 4) {
          staves.push(
            `<path d="M${cx - 4},${cy - 3.5} L${cx + 4},${cy + 3.5} M${cx - 4},${cy + 3.5} L${cx + 4},${cy - 3.5}" stroke="#18181b" stroke-width="1.6"/>`,
          );
        } else {
          staves.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="4.8" ry="3.4" transform="rotate(-18 ${cx} ${cy})" fill="#18181b"/>`,
          );
        }

        // Stem up
        staves.push(`<line x1="${cx + 4.2}" y1="${cy}" x2="${cx + 4.2}" y2="${stemTopY}" stroke="#18181b" stroke-width="1.2"/>`);

        // Accents on strong notes
        if (density !== "sparse" && (n === 0 || seed === 4 || seed === 8)) {
          staves.push(
            `<path d="M${cx - 4},${stemTopY - 9} L${cx + 5},${stemTopY - 6} L${cx - 4},${stemTopY - 3}" fill="none" stroke="#18181b" stroke-width="1.3"/>`,
          );
        }

        // Diddle slashes on dense rudimental/DCI passages
        if (isSnareOnly && density === "dense" && (seed === 2 || seed === 7)) {
          staves.push(
            `<line x1="${cx}" y1="${stemTopY + 12}" x2="${cx + 8}" y2="${stemTopY + 8}" stroke="#18181b" stroke-width="1.5"/>`,
            `<line x1="${cx}" y1="${stemTopY + 16}" x2="${cx + 8}" y2="${stemTopY + 12}" stroke="#18181b" stroke-width="1.5"/>`,
          );
        }

        // Sticking letters underneath snare music
        if (sticking.length > 0) {
          const hand = sticking[(n + barIdx * 2 + staffIdx) % sticking.length];
          staves.push(
            `<text x="${cx}" y="${baseY + 52}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="600" fill="#3f3f46" text-anchor="middle">${escapeXml(hand)}</text>`,
          );
        }
      }

      // Connect beams in groups of 2 or 4
      const groupSize = density === "sparse" ? 2 : Math.min(4, noteCountPerBar);
      for (let g = 0; g + 1 < noteCountPerBar; g += groupSize) {
        const endIdx = Math.min(g + groupSize - 1, noteCountPerBar - 1);
        const xStart = Math.round(bar.x0 + g * step + 14.2);
        const xEnd = Math.round(bar.x0 + endIdx * step + 14.2);
        staves.push(`<line x1="${xStart}" y1="${stemTopY}" x2="${xEnd}" y2="${stemTopY}" stroke="#18181b" stroke-width="3.2"/>`);
        if (density !== "sparse") {
          staves.push(
            `<line x1="${xStart}" y1="${stemTopY + 5.5}" x2="${xEnd}" y2="${stemTopY + 5.5}" stroke="#18181b" stroke-width="2.6"/>`,
          );
        }
      }
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 780" width="600" height="780">
  <rect width="600" height="780" fill="#fcfbf7"/>
  <rect x="18" y="18" width="564" height="744" fill="none" stroke="#e4e4e7" stroke-width="1"/>
  <text x="300" y="68" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" fill="#18181b" text-anchor="middle">${escapeXml(opts.title)}</text>
  <text x="300" y="92" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-style="italic" fill="#52525b" text-anchor="middle">${escapeXml(opts.artistOrCorps)} · ${escapeXml(opts.instrument)} (${escapeXml(opts.category)})</text>
  <text x="58" y="148" font-family="Georgia, serif" font-size="12" font-weight="700" fill="#27272a">♩ = ${tempo}</text>
  <text x="542" y="148" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="#71717a" text-anchor="end">Transcribed Edition</text>
  ${staves.join("\n  ")}
  <text x="300" y="750" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="#a1a1aa" text-anchor="middle">DrumScroll Sheet Preview</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

interface SeedSpec {
  title: string;
  artistOrCorps: string;
  instrument: Instrument;
  category: Category;
  difficulty?: Difficulty;
  pageCount: number;
  sourceUrl: string;
  pdfUrl: string;
  sourceSite: string;
  timeSig?: [number, number];
  tempo?: number;
  sticking?: string[];
  density?: "sparse" | "medium" | "dense";
}

const STARTER_TRANSCRIPTIONS: SeedSpec[] = [
  {
    title: "8 on a Hand — Lot Foundation Warmup",
    artistOrCorps: "Blue Devils C",
    instrument: "Snare",
    category: "DCI",
    pageCount: 1,
    sourceUrl: "https://www.lothype.com/",
    pdfUrl: "https://www.lothype.com/#seed-bdc-8-on-a-hand",
    sourceSite: "lothype",
    timeSig: [4, 4],
    tempo: 116,
    sticking: ["R", "R", "R", "R", "L", "L", "L", "L"],
    density: "sparse",
  },
  {
    title: "Double Beat & Accent-Tap Lot Sequence",
    artistOrCorps: "Blue Devils B",
    instrument: "Snare",
    category: "DCI",
    pageCount: 2,
    sourceUrl: "https://www.lothype.com/",
    pdfUrl: "https://www.lothype.com/#seed-bdb-double-beat",
    sourceSite: "lothype",
    timeSig: [4, 4],
    tempo: 144,
    sticking: ["R", "R", "L", "L", "R", "L", "R", "L"],
    density: "medium",
  },
  {
    title: "The Cut-Outs — Opener Snare Break",
    artistOrCorps: "Blue Devils",
    instrument: "Snare",
    category: "DCI",
    pageCount: 2,
    sourceUrl: "https://www.reddit.com/r/DrumlineSheets/",
    pdfUrl: "https://www.reddit.com/r/DrumlineSheets/#seed-bd-opener-break",
    sourceSite: "drumlinesheets",
    timeSig: [4, 4],
    tempo: 184,
    sticking: ["R", "L", "R", "R", "L", "R", "L", "L"],
    density: "dense",
  },
  {
    title: "Babylon — Finals Closer Snare Feature",
    artistOrCorps: "Santa Clara Vanguard",
    instrument: "Snare",
    category: "DCI",
    pageCount: 3,
    sourceUrl: "https://www.reddit.com/r/DrumlineSheets/",
    pdfUrl: "https://www.reddit.com/r/DrumlineSheets/#seed-scv-babylon-closer",
    sourceSite: "drumlinesheets",
    timeSig: [5, 4],
    tempo: 176,
    sticking: ["R", "L", "R", "L", "R", "R", "L", "L"],
    density: "dense",
  },
  {
    title: "Change Is Everything — Snare Feature",
    artistOrCorps: "Bluecoats",
    instrument: "Snare",
    category: "DCI",
    pageCount: 2,
    sourceUrl: "https://www.reddit.com/r/DrumlineSheets/",
    pdfUrl: "https://www.reddit.com/r/DrumlineSheets/#seed-bluecoats-feature",
    sourceSite: "drumlinesheets",
    timeSig: [6, 8],
    tempo: 168,
    sticking: ["R", "L", "L", "R", "R", "L"],
    density: "dense",
  },
  {
    title: "Sinnerman — Opener Movement Snare Book",
    artistOrCorps: "Mandarins",
    instrument: "Snare",
    category: "DCI",
    pageCount: 2,
    sourceUrl: "https://www.reddit.com/r/DrumlineSheets/",
    pdfUrl: "https://www.reddit.com/r/DrumlineSheets/#seed-mandarins-opener",
    sourceSite: "drumlinesheets",
    timeSig: [4, 4],
    tempo: 164,
    sticking: ["R", "L", "R", "L", "R", "R", "L", "R"],
    density: "medium",
  },
  {
    title: "Finals Production — Full Indoor Snare Break",
    artistOrCorps: "Pulse Percussion",
    instrument: "Snare",
    category: "WGI",
    pageCount: 3,
    sourceUrl: "https://www.reddit.com/r/DrumlineSheets/",
    pdfUrl: "https://www.reddit.com/r/DrumlineSheets/#seed-pulse-indoor-break",
    sourceSite: "drumlinesheets",
    timeSig: [4, 4],
    tempo: 188,
    sticking: ["R", "l", "r", "L", "r", "l", "R", "L"],
    density: "dense",
  },
  {
    title: "Broken City Closer — Quad/Snare Unison Ram",
    artistOrCorps: "Broken City",
    instrument: "Snare",
    category: "WGI",
    pageCount: 2,
    sourceUrl: "https://www.lothype.com/",
    pdfUrl: "https://www.lothype.com/#seed-broken-city-closer",
    sourceSite: "lothype",
    timeSig: [7, 8],
    tempo: 180,
    sticking: ["R", "L", "R", "L", "R", "R", "L"],
    density: "dense",
  },
  {
    title: "Stick Control & Paradiddle Grid Foundation",
    artistOrCorps: "Traditional Rudimental",
    instrument: "Snare",
    category: "Rudimental",
    pageCount: 1,
    sourceUrl: "https://www.lothype.com/",
    pdfUrl: "https://www.lothype.com/#seed-stick-control-basic",
    sourceSite: "lothype",
    timeSig: [4, 4],
    tempo: 108,
    sticking: ["R", "L", "R", "R", "L", "R", "L", "L"],
    density: "sparse",
  },
  {
    title: "Wilcoxon All-American Drummer — Solo No. 131",
    artistOrCorps: "Charley Wilcoxon",
    instrument: "Snare",
    category: "Rudimental",
    difficulty: "Advanced",
    pageCount: 2,
    sourceUrl: "https://www.lothype.com/",
    pdfUrl: "https://www.lothype.com/#seed-wilcoxon-131",
    sourceSite: "lothype",
    timeSig: [2, 4],
    tempo: 124,
    sticking: ["R", "L", "R", "R", "L", "R", "L", "L"],
    density: "medium",
  },
  {
    title: "Seven Steps to Heaven — Drum Solo Transcription",
    artistOrCorps: "Tony Williams (Miles Davis Quintet)",
    instrument: "Drumset",
    category: "Jazz",
    pageCount: 3,
    sourceUrl: "https://www.onjazzdrumming.com/",
    pdfUrl: "https://www.onjazzdrumming.com/#seed-tony-williams-seven-steps",
    sourceSite: "onjazzdrumming",
    timeSig: [4, 4],
    tempo: 284,
    density: "dense",
  },
  {
    title: "Three-Four & Bebop Trading Fours on Confirmation",
    artistOrCorps: "Max Roach",
    instrument: "Drumset",
    category: "Jazz",
    pageCount: 2,
    sourceUrl: "https://www.onjazzdrumming.com/",
    pdfUrl: "https://www.onjazzdrumming.com/#seed-max-roach-confirmation",
    sourceSite: "onjazzdrumming",
    timeSig: [4, 4],
    tempo: 220,
    density: "dense",
  },
  {
    title: "Moanin' — Shuffle Jazz Groove & Comping Chorus",
    artistOrCorps: "Art Blakey & The Jazz Messengers",
    instrument: "Drumset",
    category: "Jazz",
    pageCount: 2,
    sourceUrl: "https://www.onjazzdrumming.com/",
    pdfUrl: "https://www.onjazzdrumming.com/#seed-art-blakey-moanin",
    sourceSite: "onjazzdrumming",
    timeSig: [4, 4],
    tempo: 126,
    density: "medium",
  },
  {
    title: "Basic Jazz Spang-a-Lang & Feathering Starter",
    artistOrCorps: "Jazz Foundation Studio",
    instrument: "Drumset",
    category: "Jazz",
    pageCount: 1,
    sourceUrl: "https://www.onjazzdrumming.com/",
    pdfUrl: "https://www.onjazzdrumming.com/#seed-basic-jazz-swing",
    sourceSite: "onjazzdrumming",
    timeSig: [4, 4],
    tempo: 120,
    density: "sparse",
  },
  {
    title: "What About Me? — Full Drum Solo & Outro Transcription",
    artistOrCorps: "Larnell Lewis (Snarky Puppy)",
    instrument: "Drumset",
    category: "Rock/Funk",
    pageCount: 5,
    sourceUrl: "https://francisdrummingblog.com/",
    pdfUrl: "https://francisdrummingblog.com/#seed-larnell-lewis-what-about-me",
    sourceSite: "francis",
    timeSig: [4, 4],
    tempo: 128,
    density: "dense",
  },
  {
    title: "What Is Hip? — Linear Funk Groove & Ghost-Note Study",
    artistOrCorps: "David Garibaldi (Tower of Power)",
    instrument: "Drumset",
    category: "Rock/Funk",
    pageCount: 2,
    sourceUrl: "https://francisdrummingblog.com/",
    pdfUrl: "https://francisdrummingblog.com/#seed-garibaldi-what-is-hip",
    sourceSite: "francis",
    timeSig: [4, 4],
    tempo: 106,
    density: "dense",
  },
  {
    title: "Rosanna — Half-Time Shuffle Groove Breakdown",
    artistOrCorps: "Jeff Porcaro (Toto)",
    instrument: "Drumset",
    category: "Rock/Funk",
    pageCount: 2,
    sourceUrl: "https://francisdrummingblog.com/",
    pdfUrl: "https://francisdrummingblog.com/#seed-porcaro-rosanna-groove",
    sourceSite: "francis",
    timeSig: [4, 4],
    tempo: 86,
    density: "medium",
  },
  {
    title: "Basic Pocket Backbeat & 8th-Note Rock Grooves",
    artistOrCorps: "Francis' Drumming Blog",
    instrument: "Drumset",
    category: "Rock/Funk",
    pageCount: 1,
    sourceUrl: "https://francisdrummingblog.com/",
    pdfUrl: "https://francisdrummingblog.com/#seed-basic-rock-backbeat",
    sourceSite: "francis",
    timeSig: [4, 4],
    tempo: 96,
    density: "sparse",
  },
];

export async function seedDrumScrollDatabase(db: Database): Promise<void> {
  // Always ensure the registered scraper sources exist
  for (const src of STARTER_SOURCES) {
    await db
      .insert(drumscrollSources)
      .values(src)
      .onConflictDoNothing({ target: drumscrollSources.id });
  }

  // Only seed starter transcriptions when the catalog is completely empty
  const [{ value: existingCount }] = await db.select({ value: count() }).from(drumscrollTranscriptions);
  if (Number(existingCount) > 0) return;

  const rows = STARTER_TRANSCRIPTIONS.map((item) => {
    const difficulty =
      item.difficulty ??
      estimateDifficulty({
        title: item.title,
        artistOrCorps: item.artistOrCorps,
        instrument: item.instrument,
        category: item.category,
        pageCount: item.pageCount,
      });

    return {
      title: item.title,
      artistOrCorps: item.artistOrCorps,
      instrument: item.instrument,
      category: item.category,
      difficulty,
      difficultyOverridden: false,
      pageCount: item.pageCount,
      sourceUrl: item.sourceUrl,
      pdfUrl: item.pdfUrl,
      previewImageUrl: buildEngravedSheetSvgDataUrl({
        title: item.title,
        artistOrCorps: item.artistOrCorps,
        instrument: item.instrument,
        category: item.category,
        timeSig: item.timeSig,
        tempo: item.tempo,
        sticking: item.sticking,
        density: item.density,
      }),
      bookmarked: false,
      sourceSite: item.sourceSite,
    };
  });

  await db
    .insert(drumscrollTranscriptions)
    .values(rows)
    .onConflictDoNothing({ target: drumscrollTranscriptions.pdfUrl });

  // Update starter source counts so the Scraper drawer accurately reflects seeded items
  const countsBySite = new Map<string, number>();
  for (const r of rows) {
    countsBySite.set(r.sourceSite, (countsBySite.get(r.sourceSite) ?? 0) + 1);
  }
  const { eq } = await import("drizzle-orm");
  for (const [siteId, cnt] of countsBySite.entries()) {
    await db.update(drumscrollSources).set({ itemCount: cnt }).where(eq(drumscrollSources.id, siteId));
  }
}
