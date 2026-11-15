import type { Category, Difficulty, Instrument } from "../lib/constants";

export interface TaggerInput {
  title: string;
  artistOrCorps?: string;
  instrument?: Instrument;
  category?: Category;
  pageCount?: number;
}

const BEGINNER_PATTERNS: RegExp[] = [
  /\b8\s*on\s*a\s*hand\b/i,
  /\beights\b/i,
  /\b8'?s\b/i,
  /\bblue\s+devils\s+c\b/i,
  /\bbdc\b/i,
  /\bbeginner\b/i,
  /\bbasic\b/i,
  /\bintro(?:duction)?\b/i,
  /\bfoundation(?:s)?\b/i,
  /\bstick\s+control\b/i,
  /\bstarter\b/i,
  /\beasy\b/i,
  /\bfirst\s+(?:beat|groove|rudiment)\b/i,
];

const INTERMEDIATE_CORPS_OR_EXERCISES: RegExp[] = [
  /\bblue\s+devils\s+b\b/i,
  /\bbdb\b/i,
  /\bvanguard\s+cadets\b/i,
  /\bscvc\b/i,
  /\bopen\s+class\b/i,
  /\bcolt\s+cadets\b/i,
  /\briver\s+city\s+rhythm\b/i,
  /\bspartans\b/i,
  /\bgold\s+drum\b/i,
  /\bcadence\b/i,
  /\bstreet\s+beat\b/i,
  /\baccent[\s-]*tap\b/i,
  /\bbucks\b/i,
  /\bdouble\s+beat\b/i,
  /\blegatos?\b/i,
  /\bwarm[\s-]*up\b/i,
  /\bexercise\b/i,
  /\betude\b/i,
  /\bgroove\b/i,
];

const PRO_PATTERNS: RegExp[] = [
  // World Class DCI & WGI powerhouses
  /\bblue\s+devils\b/i,
  /\bsanta\s+clara\s+vanguard\b/i,
  /\bscv\b/i,
  /\bbluecoats\b/i,
  /\bcarolina\s+crown\b/i,
  /\bcavaliers\b/i,
  /\bboston\s+crusaders\b/i,
  /\b(?:the\s+)?cadets\b/i,
  /\bpulse\s+percussion\b/i,
  /\brhythm\s+x\b/i,
  /\bbroken\s+city\b/i,
  /\brcc\b/i,
  /\bmusic\s+city\s+mystique\b/i,
  /\bmcm\b/i,
  /\bchino\s+hills\b/i,
  /\bayala\b/i,
  /\bavon\b/i,
  /\bdartmouth\b/i,
  /\bworld\s+class\b/i,
  /\bsanford\b/i,
  /\bi\s*&\s*e\b/i,
  /\bkeelan\b/i,
  /\bjeff\s+queen\b/i,
  /\bscott\s+johnson\b/i,
  /\bpaul\s+rennick\b/i,
  /\bcolin\s+mcnutt\b/i,
  // Pro / virtuoso drumset artists
  /\btony\s+williams\b/i,
  /\blarnell\s+lewis\b/i,
  /\bvinnie\s+colaiuta\b/i,
  /\bbuddy\s+rich\b/i,
  /\belvin\s+jones\b/i,
  /\bmax\s+roach\b/i,
  /\bdave\s+weckl\b/i,
  /\bsteve\s+gadd\b/i,
  /\bnate\s+smith\b/i,
  /\bmark\s+guiliana\b/i,
  /\beric\s+harland\b/i,
  /\bbrian\s+blade\b/i,
  /\bari\s+hoenig\b/i,
  /\bbill\s+stewart\b/i,
  /\bbenny\s+greb\b/i,
  /\bmatt\s+garstka\b/i,
  /\bgavin\s+harrison\b/i,
  /\bdanny\s+carey\b/i,
  /\bvirgil\s+donati\b/i,
  /\bthomas\s+lang\b/i,
  /\bchris\s+coleman\b/i,
  /\bsnarky\s+puppy\b/i,
];

const ADVANCED_PATTERNS: RegExp[] = [
  /\bphantom\s+regiment\b/i,
  /\bmandarins\b/i,
  /\btroopers\b/i,
  /\bcrossmen\b/i,
  /\bblue\s+stars\b/i,
  /\bblue\s+knights\b/i,
  /\bmadison\s+scouts\b/i,
  /\bcolts\b/i,
  /\bpacific\s+crest\b/i,
  /\bspirit\s+of\s+atlanta\b/i,
  /\bthe\s+academy\b/i,
  /\bstryke\b/i,
  /\binfinity\s+percussion\b/i,
  /\bunited\s+percussion\b/i,
  /\bmonarch\b/i,
  /\bmatrix\b/i,
  /\bgates?\s+of\b/i,
  /\bart\s+blakey\b/i,
  /\bphilly\s+joe\b/i,
  /\broy\s+haynes\b/i,
  /\bjeff\s+porcaro\b/i,
  /\bjohn\s+bonham\b/i,
  /\bneil\s+peart\b/i,
  /\bstewart\s+copeland\b/i,
  /\bclyde\s+stubblefield\b/i,
  /\bdavid\s+garibaldi\b/i,
  /\btower\s+of\s+power\b/i,
  /\blinear\b/i,
  /\bodd\s+time\b/i,
  /\bpolyrhythm\b/i,
  /\bmetric\s+modulation\b/i,
  /\bup[\s-]*tempo\b/i,
  /\bbebop\b/i,
  /\bfusion\b/i,
  /\bafro[\s-]*cuban\b/i,
  /\bsongo\b/i,
  /\bdrum\s+solo\b/i,
  /\bsnare\s+break\b/i,
  /\bdrum\s+feature\b/i,
  /\bopener\b/i,
  /\bcloser\b/i,
  /\bballad\b/i,
  /\bfinals\b/i,
];

const WARMUP_ONLY_RE = /\b(?:warm[\s-]*up|legatos?|8\s*on\s*a\s*hand|eights|accent[\s-]*tap|bucks|double\s+beat)\b/i;

/**
 * Estimates sheet difficulty using musical/percussion heuristics when a source
 * doesn't explicitly grade its sheets.
 */
export function estimateDifficulty(input: TaggerInput): Difficulty {
  const haystack = `${input.title} ${input.artistOrCorps ?? ""}`.trim();

  // 1. Check Beginner rules first (e.g. "Blue Devils C", "8 on a hand", "Warmup Basic")
  if (BEGINNER_PATTERNS.some((re) => re.test(haystack))) {
    return "Beginner";
  }

  // 2. Check Open Class / B-corps before World Class parent corps names ("Blue Devils B" before "Blue Devils")
  if (/\b(?:blue\s+devils\s+b|bdb|vanguard\s+cadets|scvc|colt\s+cadets|open\s+class)\b/i.test(haystack)) {
    return "Intermediate";
  }

  // 3. World Class corps & pro virtuoso transcriptions
  if (PRO_PATTERNS.some((re) => re.test(haystack))) {
    // A World Class corps' basic lot warmup (e.g. "Blue Devils Legatos Warmup") is Intermediate/Advanced rather than World Class show book
    if (WARMUP_ONLY_RE.test(input.title)) {
      return "Intermediate";
    }
    return "World Class/Pro";
  }

  // 4. Advanced corps, solo features, odd-time/bebop/linear charts (before generic "groove"/"exercise")
  if (ADVANCED_PATTERNS.some((re) => re.test(haystack))) {
    if (WARMUP_ONLY_RE.test(input.title)) {
      return "Intermediate";
    }
    return "Advanced";
  }

  // 5. Intermediate exercises, grooves, cadences
  if (INTERMEDIATE_CORPS_OR_EXERCISES.some((re) => re.test(haystack))) {
    return "Intermediate";
  }

  // 6. Fallback heuristics
  if ((input.pageCount ?? 1) >= 3) {
    return "Advanced";
  }
  return "Intermediate";
}

/**
 * Infers Category ('DCI' | 'WGI' | 'Jazz' | 'Rock/Funk' | 'Rudimental') from text
 * when a scraper source spans multiple styles.
 */
export function inferCategory(text: string, instrument: Instrument, fallback: Category): Category {
  if (instrument === "Snare") {
    if (
      /\b(?:wgi|indoor|pulse|rhythm\s+x|broken\s+city|rcc|mystique|mcm|chino\s+hills|ayala|avon|dartmouth|stryke|infinity|united|monarch|matrix|capitol)\b/i.test(
        text,
      )
    ) {
      return "WGI";
    }
    if (
      /\b(?:dci|blue\s+devils|vanguard|scv|bluecoats|crown|cavaliers|crusaders|cadets|phantom|mandarins|troopers|crossmen|blue\s+stars|blue\s+knights|scouts|colts)\b/i.test(
        text,
      )
    ) {
      return "DCI";
    }
    if (/\b(?:rudiment|wilcoxon|pratt|solo|etude|flam|paradiddle|ratamacue|stick\s+control|cadence)\b/i.test(text)) {
      return "Rudimental";
    }
    return fallback;
  }

  // Drumset category inference
  if (
    /\b(?:jazz|swing|bebop|bop|big\s+band|bossa|samba|tony\s+williams|elvin|blakey|max\s+roach|philly\s+joe|buddy\s+rich|bill\s+stewart|brian\s+blade|roy\s+haynes|miles\s+davis|coltrane)\b/i.test(
      text,
    )
  ) {
    return "Jazz";
  }
  if (/\b(?:rudiment|march|wilcoxon|snare\s+etude)\b/i.test(text)) {
    return "Rudimental";
  }
  if (
    /\b(?:funk|rock|groove|fusion|pop|soul|r&b|hip[\s-]*hop|backbeat|porcaro|bonham|peart|gadd|garibaldi|tower\s+of\s+power|stubblefield|snarky|larnell|nate\s+smith|vinnie)\b/i.test(
      text,
    )
  ) {
    return "Rock/Funk";
  }
  return fallback;
}

/**
 * Infers Instrument ('Snare' | 'Drumset') from text when needed.
 */
export function inferInstrument(text: string, fallback: Instrument): Instrument {
  if (/\b(?:drum\s*set|drum\s*kit|hi[\s-]*hat|kick|ride\s+cymbal|groove|backbeat|funk|jazz\s+solo)\b/i.test(text)) {
    return "Drumset";
  }
  if (/\b(?:snare|drumline|dci|wgi|corps|indoor|marching|hybrid\s+rudiment)\b/i.test(text)) {
    return "Snare";
  }
  return fallback;
}
