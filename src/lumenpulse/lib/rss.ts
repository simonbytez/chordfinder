import { RELEASE_STATUS_LABELS, TRIGGER_LABELS } from "./constants";
import { absolute } from "./env";
import { specLine } from "./alerts/payload";
import { fmtCandela, fmtInt, fmtPrice } from "./specs";
import type { LightDTO } from "./types";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

function itemTitle(l: LightDTO): string {
  const name = `${l.brand} ${l.modelName}`;
  if (l.latestEvent && l.lastEventAt) return `${TRIGGER_LABELS[l.latestEvent.type].replace(" ≥10%", "")}: ${name}`;
  return l.releaseStatus === "active" ? name : `${RELEASE_STATUS_LABELS[l.releaseStatus]}: ${name}`;
}

function itemHtml(l: LightDTO, url: string): string {
  const img = l.imageUrls[0] ? `<p><img src="${xml(l.imageUrls[0])}" alt="${xml(`${l.brand} ${l.modelName}`)}" width="480" /></p>` : "";
  const rows: [string, string][] = [
    ["Specs", specLine(l) || "—"],
    ["Max output", l.maxLumens ? `${fmtInt(l.maxLumens)} lm` : "—"],
    ["Intensity", l.maxCandela ? fmtCandela(l.maxCandela) : "—"],
    ["Throw", l.throwMeters ? `${fmtInt(l.throwMeters)} m` : "—"],
    ["Price", l.bestPrice ? `${fmtPrice(l.bestPrice.price)} at ${l.bestPrice.sourceName}${l.bestPrice.verified ? "" : " (unverified)"}` : "—"],
  ];
  const table = `<table>${rows.map(([k, v]) => `<tr><td><strong>${xml(k)}</strong></td><td>${xml(v)}</td></tr>`).join("")}</table>`;
  const desc = l.description ? `<p>${xml(l.description.slice(0, 400))}</p>` : "";
  return `${img}${table}${desc}<p><a href="${xml(url)}">Open in LumenPulse</a></p>`;
}

/** RSS 2.0 with media:content images and per-event GUIDs (restocks re-surface as new items). */
export function buildRss(items: LightDTO[], meta: { title: string; description: string; selfUrl: string; siteUrl: string }): string {
  const now = new Date().toUTCString();
  const entries = items
    .map((l) => {
      const url = absolute(`/flashlights/light/${l.slug}`);
      const when = l.lastEventAt ?? l.firstSeenAt;
      const guid = `${l.slug}@${new Date(when).getTime()}`;
      const img = l.imageUrls[0];
      return `    <item>
      <title>${xml(itemTitle(l))}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="false">${xml(guid)}</guid>
      <pubDate>${new Date(when).toUTCString()}</pubDate>
      <category>${xml(l.brand)}</category>
      <description>${cdata(itemHtml(l, url))}</description>${img ? `\n      <media:content url="${xml(img)}" medium="image" />\n      <enclosure url="${xml(img)}" type="${/\.png(\?|$)/i.test(img) ? "image/png" : /\.webp(\?|$)/i.test(img) ? "image/webp" : "image/jpeg"}" length="0" />` : ""}
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xml(meta.title)}</title>
    <link>${xml(meta.siteUrl)}</link>
    <description>${xml(meta.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${xml(meta.selfUrl)}" rel="self" type="application/rss+xml" />
    <image><url>${xml(absolute("/flashlights/icons/icon-192.png"))}</url><title>${xml(meta.title)}</title><link>${xml(meta.siteUrl)}</link></image>
${entries}
  </channel>
</rss>`;
}
