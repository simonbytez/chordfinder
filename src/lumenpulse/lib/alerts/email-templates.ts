import { absolute } from "../env";
import { fmtPrice } from "../specs";
import type { AlertPayload } from "./payload";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EVENT_LABEL: Record<string, string> = {
  new_release: "NEW RELEASE",
  restock: "BACK IN STOCK",
  price_drop: "PRICE DROP",
  test: "TEST",
};

function shell(title: string, inner: string, footer: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #1e293b;">
<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;box-shadow:0 0 12px #f59e0b;margin-right:8px;vertical-align:middle;"></span>
<span style="font-weight:700;letter-spacing:.04em;color:#fef3c7;vertical-align:middle;">LumenPulse</span>
</td></tr>
${inner}
<tr><td style="padding:16px 24px;border-top:1px solid #1e293b;font-size:12px;color:#64748b;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function itemBlock(p: AlertPayload): string {
  const img = p.imageUrl
    ? `<td width="96" valign="top" style="padding-right:16px;"><img src="${esc(p.imageUrl)}" width="96" height="96" alt="" style="display:block;border-radius:10px;object-fit:cover;background:#111827;"></td>`
    : "";
  const priceRow =
    p.light?.price != null
      ? `<div style="margin-top:8px;font-size:15px;color:#fde68a;font-weight:600;">${p.light.oldPrice && p.eventType === "price_drop" ? `<s style="color:#64748b;font-weight:400;">${fmtPrice(p.light.oldPrice)}</s> ` : ""}${fmtPrice(p.light.price)}${p.light.vendor ? ` <span style="color:#94a3b8;font-weight:400;">at ${esc(p.light.vendor)}</span>` : ""}</div>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${img}
<td valign="top">
<div style="font-size:11px;letter-spacing:.12em;color:#f59e0b;font-weight:700;">${EVENT_LABEL[p.eventType] ?? ""}</div>
<div style="margin-top:4px;font-size:18px;font-weight:700;color:#f8fafc;">${esc(p.light ? `${p.light.brand} ${p.light.modelName}` : p.title)}</div>
${p.light?.specLine ? `<div style="margin-top:6px;font-size:13px;color:#cbd5e1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(p.light.specLine)}</div>` : ""}
${priceRow}
<div style="margin-top:12px;">
<a href="${esc(p.url)}" style="display:inline-block;background:#f59e0b;color:#1a1203;text-decoration:none;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;">View in LumenPulse</a>
${p.light?.vendorUrl ? `<a href="${esc(p.light.vendorUrl)}" style="display:inline-block;margin-left:8px;color:#e2e8f0;text-decoration:none;font-size:13px;padding:8px 14px;border-radius:8px;border:1px solid #334155;">Open store</a>` : ""}
</div></td></tr></table>`;
}

const manageFooter = () => `You're receiving this because of an alert rule in LumenPulse. <a href="${absolute("/flashlights/alerts")}" style="color:#94a3b8;">Manage alerts</a>`;

export function renderInstantEmail(p: AlertPayload): { subject: string; html: string; text: string } {
  return {
    subject: p.title,
    html: shell(p.title, `<tr><td style="padding:24px;">${itemBlock(p)}</td></tr>`, manageFooter()),
    text: `${p.title}\n${p.body}\n\n${p.url}`,
  };
}

export function renderDigestEmail(items: AlertPayload[], schedule: "daily" | "weekly_friday"): { subject: string; html: string; text: string } {
  const label = schedule === "daily" ? "Daily" : "Friday";
  const subject = `${label} beam report: ${items.length} match${items.length === 1 ? "" : "es"}`;
  const rows = items.map((p) => `<tr><td style="padding:18px 24px;border-bottom:1px solid #1e293b;">${itemBlock(p)}</td></tr>`).join("");
  const intro = `<tr><td style="padding:22px 24px 6px;"><div style="font-size:20px;font-weight:700;color:#f8fafc;">${label} digest</div><div style="margin-top:4px;color:#94a3b8;font-size:13px;">${items.length} new match${items.length === 1 ? "" : "es"} across your alert rules.</div></td></tr>`;
  return {
    subject,
    html: shell(subject, intro + rows, manageFooter()),
    text: items.map((p) => `• ${p.title}\n  ${p.body.replace(/\n/g, " · ")}\n  ${p.url}`).join("\n\n"),
  };
}
