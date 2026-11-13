# LumenPulse

Lives at **boomcat.me/flashlights**. An installable PWA for flashlight enthusiasts that combines a parametric spec database, a multi-store release/restock aggregator, a community radar, and an alert engine that sends matches to Web Push, ntfy.sh, Discord, email or RSS.

It is the one boomcat app on the **App Router**. The other apps stay on the Pages Router in `pages/`, and both routers share one Next.js build.

## Running it

```bash
npm run dev        # then open http://localhost:3000/flashlights
```

No database setup is needed locally. Without `LUMENPULSE_DATABASE_URL` it runs on **embedded PGlite** (real PostgreSQL 18 compiled to WASM) stored in `.data/lumenpulse`. On the first request it applies the SQL migrations and seeds 14 sources plus 26 hand-checked lights.

For Web Push locally, `npm run lumenpulse:vapid` writes VAPID keys into `.env.local`. Every variable is documented in [.env.example](.env.example).

> **Windows:** run `npm run build` from a terminal whose path starts with a capital `C:\`. With a lowercase `c:\` working directory, Node loads React twice and prerendering the Pages Router apps fails with "Cannot read properties of null (reading 'useContext')". `npm run dev` and Vercel are unaffected.

## Where things are

| Path | What |
| --- | --- |
| `app/flashlights/` | Pages and the root layout: catalog (`/flashlights`), `/light/[slug]`, `/alerts`, `/admin`, `/offline` |
| `app/api/flashlights/` | `cron/*`, `rss`, `push/subscribe` |
| `src/lumenpulse/` | Everything else: components, server actions, `lib/` (filters, ingestion, alerts), `db/` (schema, seed), `drizzle/` (SQL migrations), scripts |
| `src/lumenpulse/globals.tailwind.css` | The only stylesheet. Tailwind runs on this file alone (see the turbopack rule in `next.config.js`), so it never touches the other apps |
| `public/flashlights/` | `sw.js`, `manifest.json`, icons. The service worker is scoped to `/flashlights` and doesn't control the rest of boomcat |
| `proxy.ts` (repo root) | Runs only for `/flashlights/*`: sets the anonymous `lp_uid` device cookie and puts `/flashlights/admin` behind Basic auth when `LUMENPULSE_ADMIN_PASSWORD` is set |

Imports use the `@lp/*` alias for `src/lumenpulse/*` (see `tsconfig.json`).

## Using it

| Where | What |
| --- | --- |
| `/flashlights` | **Fresh Drops** (default), **Deep Vault** (`?mode=vault`) and **Community Radar** (`?mode=radar`). Filters are synced to the URL, so every view is shareable. From any view: **Create alert from filters**, **Copy RSS URL** and **Random Grail**. |
| card / drawer | Own · Wish · Watch, the flood↔throw bar, spec pills, and add-to-compare (up to 3 side by side). |
| `/flashlights/light/[slug]` | Full spec sheet, emitter variants, per-vendor price and stock with price-history sparklines, and community mentions. Notification clicks open this page. |
| `/flashlights/alerts` | BeamAlerts: rule manager, match history, Web Push toggle, ntfy topic generator (QR + app deep link), Discord webhook, email digest settings, and **Send test notification**. |
| `/flashlights/admin` | Sources with **Run sync now**, pause/resume and poll intervals; add source, recent events, digest trigger, and the manual add/edit flashlight form. |
| `/api/flashlights/rss?…` | RSS 2.0 for any catalog query, e.g. `/api/flashlights/rss?bat=21700&fw=anduril_2&cri=1&cct=4000-5000`. |

## How ingestion behaves

- **A source's first sync is a silent backfill.** Products become catalog entries without firing alerts; events start on the next sync.
- **The LLM only runs for brand-new products**, at most `LUMENPULSE_LLM_MAX_EXTRACTIONS_PER_RUN` per run. The regex parser fills any gaps, and does all the extraction when no key is set or the LLM call fails.
- **Each alert match is unique per (rule, event)**, and events are marked processed only after dispatch, so re-running a cron never sends a notification twice.

## Cron (zero-cost)

All three endpoints accept GET or POST with `Authorization: Bearer $CRON_SECRET`. Each call only processes sources that are due, so calling more often than needed is harmless.

```
https://boomcat.me/api/flashlights/cron/ingest-stores      ?source=<id> &force=1 &max=<sources per call, default 3>
https://boomcat.me/api/flashlights/cron/ingest-community
https://boomcat.me/api/flashlights/cron/send-digests       daily, or Fridays for weekly; call hourly
```

Vercel Cron on the Hobby plan only runs once a day, so use an outside scheduler:

**cron-job.org:** create one job per endpoint every 20 minutes, with an `Authorization: Bearer …` header.

**Cloudflare Workers Cron** (`wrangler.toml`: `[triggers] crons = ["*/20 * * * *"]`):

```js
export default {
  async scheduled(_event, env, ctx) {
    const h = { Authorization: `Bearer ${env.CRON_SECRET}` };
    for (const p of ["ingest-stores", "ingest-community", "send-digests"])
      ctx.waitUntil(fetch(`https://boomcat.me/api/flashlights/cron/${p}`, { headers: h }));
  },
};
```

**Supabase `pg_cron` + `pg_net`:**

```sql
select cron.schedule('lumenpulse-stores', '*/20 * * * *', $$
  select net.http_get('https://boomcat.me/api/flashlights/cron/ingest-stores',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'));
$$);
```

## Deploying (with the rest of boomcat on Vercel)

1. **Database.** Create a Postgres database (for example Neon from the Vercel Marketplace, using the env prefix `LUMENPULSE`, or a Supabase pooled URL on port 6543) and set `LUMENPULSE_DATABASE_URL`. Without it, the deployed app runs on a throwaway PGlite in `/tmp` that resets on every cold start, and `/flashlights/admin` warns about it.
2. Migrations run automatically on first use (`LUMENPULSE_AUTO_MIGRATE`). Seeding happens when the catalog is empty. You can also run `npm run lumenpulse:db:migrate` against the URL.
3. Set `CRON_SECRET`, `LUMENPULSE_ADMIN_PASSWORD` and the three `LUMENPULSE_VAPID_*` keys. Optionally set `GEMINI_API_KEY` (or `OPENAI_API_KEY`) and `RESEND_API_KEY` + `LUMENPULSE_EMAIL_FROM`.
4. Point a cron at the endpoints above.

## Scripts

| | |
| --- | --- |
| `npm run lumenpulse:db:generate` | Diff `db/schema.ts` into a new SQL migration in `src/lumenpulse/drizzle` |
| `npm run lumenpulse:db:migrate` | Apply migrations |
| `npm run lumenpulse:db:seed` / `lumenpulse:db:reset` | Seed an empty catalog / wipe and reseed. With PGlite, stop `npm run dev` first, because only one process can open it. |
| `npm run lumenpulse:db:studio` | Drizzle Studio |
| `npm run lumenpulse:vapid` | Create VAPID keys in `.env.local` |
| `npm run lumenpulse:icons` | Re-render the PWA icons from the SVG mark |

## Data and source notes

- **Seed specs** come from maker spec sheets or named independent reviews. Unverified values are left empty rather than guessed, and caveats (claimed vs. measured lumens, weight with or without battery) are shown in each light's spec notes. Seed prices appear only where a source quoted one, labeled *est.* until a crawler verifies them.
- **The crawler always identifies itself honestly** (`LumenPulse/1.0 (+https://boomcat.me/flashlights; …)`). It honors `Retry-After` and never tries to bypass bot protection. When this was built (Nov 2026), the starter sources behaved like this:
  - Sofirn (US), Killzone, Neal's Gadgets and JLHawaii808 served `products.json`.
  - Acebeam, Olight, Hank (intl-outdoor), Zebralight and Malkoff served sitemaps.
  - **Wurkkos** answered with a Cloudflare challenge (403) and shows as an error in admin.
  - **FireflyLite** was unreachable from the test network.
  - **Convoy** has no crawlable storefront (it sells through AliExpress), so it ships paused; Neal's Gadgets covers Convoy lights.
  - **Reddit** rate-limits unauthenticated RSS clients (429/403). The radar retries on its next poll.
- **iOS Web Push** works only after *Share → Add to Home Screen* (iOS 16.4+). The in-app banner walks users through it.
