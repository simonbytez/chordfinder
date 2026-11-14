-- FireflyLite moved its store to firefly-outdoor.com; the old fireflylite.com answers crawlers with 403.
-- Clearing the run history makes the first sync at the new address a silent backfill, not 100+ "new releases".
UPDATE "sources"
SET "base_url" = 'https://www.firefly-outdoor.com', "status" = 'active', "error_log" = NULL, "last_run_stats" = NULL, "last_polled_at" = NULL
WHERE "id" = 'fireflylite' AND "base_url" = 'https://www.fireflylite.com';
--> statement-breakpoint
-- Wurkkos's store blocks crawlers with a Cloudflare challenge, so stop asking every hour. Resume it in admin
-- if Wurkkos allowlists the LumenPulse user agent.
UPDATE "sources"
SET "status" = 'paused', "error_log" = 'Paused: wurkkos.com blocks crawlers (Cloudflare 403). Resume if Wurkkos allowlists the LumenPulse user agent.'
WHERE "id" = 'wurkkos' AND "status" <> 'paused';
