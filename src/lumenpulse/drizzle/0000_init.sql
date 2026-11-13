CREATE TYPE "public"."adapter_type" AS ENUM('shopify_json', 'sitemap_xml', 'reddit_rss');--> statement-breakpoint
CREATE TYPE "public"."alert_channel" AS ENUM('web_push', 'ntfy', 'discord', 'email_instant', 'email_digest');--> statement-breakpoint
CREATE TYPE "public"."battery_type" AS ENUM('18650', '21700', '14500', '18350', '10440', 'aa', 'aaa', 'cr123a', 'built_in');--> statement-breakpoint
CREATE TYPE "public"."body_material" AS ENUM('aluminum', 'titanium', 'copper', 'brass', 'mao');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('owned', 'wishlist', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."community_platform" AS ENUM('reddit_r_flashlight', 'blf');--> statement-breakpoint
CREATE TYPE "public"."digest_schedule" AS ENUM('daily', 'weekly_friday');--> statement-breakpoint
CREATE TYPE "public"."driver_type" AS ENUM('buck', 'boost', 'buck_boost', 'linear_fet', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."firmware" AS ENUM('anduril_2', 'zebralight_ui', 'proprietary_stepped', 'ramping');--> statement-breakpoint
CREATE TYPE "public"."form_factor" AS ENUM('edc', 'thrower', 'flooder', 'headlamp_right_angle', 'keychain', 'lep', 'flat_wedge', 'lantern');--> statement-breakpoint
CREATE TYPE "public"."ip_rating" AS ENUM('IPX4', 'IPX7', 'IPX8', 'IP68');--> statement-breakpoint
CREATE TYPE "public"."optic_type" AS ENUM('tir', 'smooth_reflector', 'op_reflector', 'mule', 'lep');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('new_release', 'active', 'pre_order', 'restock', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."trigger_event" AS ENUM('new_release', 'restock', 'price_drop');--> statement-breakpoint
CREATE TABLE "alert_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"flashlight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "trigger_event" NOT NULL,
	"delivery_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"digest_pending" boolean DEFAULT false NOT NULL,
	"digest_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filter_criteria_json" jsonb NOT NULL,
	"trigger_events" "trigger_event"[] NOT NULL,
	"channels" "alert_channel"[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"watch_flashlight_id" uuid,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_title" text NOT NULL,
	"url" text NOT NULL,
	"platform" "community_platform" NOT NULL,
	"flair" text,
	"author" text,
	"excerpt" text,
	"matched_flashlight_id" uuid,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_seen_urls" (
	"source_id" text NOT NULL,
	"url" text NOT NULL,
	"is_product" boolean NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crawl_seen_urls_source_id_url_pk" PRIMARY KEY("source_id","url")
);
--> statement-breakpoint
CREATE TABLE "flashlight_emitters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashlight_id" uuid NOT NULL,
	"emitter_model" text NOT NULL,
	"led_count" integer DEFAULT 1 NOT NULL,
	"cct_kelvin" integer,
	"cri" integer,
	"tint_duv_notes" text
);
--> statement-breakpoint
CREATE TABLE "flashlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"brand" text NOT NULL,
	"model_name" text NOT NULL,
	"release_status" "release_status" DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone,
	"release_year" integer,
	"image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"raw_description" text,
	"form_factor" "form_factor",
	"battery_types" "battery_type"[] DEFAULT '{}'::battery_type[] NOT NULL,
	"max_lumens" integer,
	"max_candela" integer,
	"throw_meters" integer,
	"optic_type" "optic_type",
	"driver_type" "driver_type" DEFAULT 'unknown' NOT NULL,
	"firmware" "firmware",
	"ip_rating" "ip_rating",
	"body_materials" "body_material"[] DEFAULT '{}'::body_material[] NOT NULL,
	"has_usb_c" boolean DEFAULT false NOT NULL,
	"has_magnetic_tail" boolean DEFAULT false NOT NULL,
	"has_aux_leds" boolean DEFAULT false NOT NULL,
	"has_high_cri_option" boolean DEFAULT false NOT NULL,
	"weight_grams" integer,
	"length_mm" numeric(6, 1),
	"spec_source" text DEFAULT 'seed' NOT NULL,
	"spec_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ntfy_topic_url" text,
	"discord_webhook_url" text,
	"email_address" text,
	"digest_schedule" "digest_schedule" DEFAULT 'daily' NOT NULL,
	"last_digest_sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashlight_id" uuid NOT NULL,
	"listing_id" uuid,
	"source_id" text,
	"type" "trigger_event" NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"adapter_type" "adapter_type" NOT NULL,
	"poll_interval_mins" integer DEFAULT 60 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"error_log" text,
	"last_run_stats" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flashlight_id" uuid NOT NULL,
	"status" "collection_status" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashlight_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"external_product_id" text NOT NULL,
	"product_url" text NOT NULL,
	"title" text,
	"price_usd" numeric(10, 2),
	"in_stock" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp with time zone,
	"price_history_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_event_id_product_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."product_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_flashlight_id_flashlights_id_fk" FOREIGN KEY ("flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_watch_flashlight_id_flashlights_id_fk" FOREIGN KEY ("watch_flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_matched_flashlight_id_flashlights_id_fk" FOREIGN KEY ("matched_flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_seen_urls" ADD CONSTRAINT "crawl_seen_urls_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashlight_emitters" ADD CONSTRAINT "flashlight_emitters_flashlight_id_flashlights_id_fk" FOREIGN KEY ("flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_flashlight_id_flashlights_id_fk" FOREIGN KEY ("flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_listing_id_vendor_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vendor_listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_flashlight_id_flashlights_id_fk" FOREIGN KEY ("flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_flashlight_id_flashlights_id_fk" FOREIGN KEY ("flashlight_id") REFERENCES "public"."flashlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_listings" ADD CONSTRAINT "vendor_listings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_rule_event_uq" ON "alert_matches" USING btree ("rule_id","event_id");--> statement-breakpoint
CREATE INDEX "matches_user_idx" ON "alert_matches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "matches_digest_idx" ON "alert_matches" USING btree ("digest_pending");--> statement-breakpoint
CREATE INDEX "rules_user_idx" ON "alert_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rules_active_idx" ON "alert_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rules_watch_idx" ON "alert_rules" USING btree ("watch_flashlight_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_url_uq" ON "community_mentions" USING btree ("url");--> statement-breakpoint
CREATE INDEX "mentions_published_idx" ON "community_mentions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "mentions_flashlight_idx" ON "community_mentions" USING btree ("matched_flashlight_id");--> statement-breakpoint
CREATE INDEX "emitters_flashlight_idx" ON "flashlight_emitters" USING btree ("flashlight_id");--> statement-breakpoint
CREATE INDEX "emitters_cct_idx" ON "flashlight_emitters" USING btree ("cct_kelvin");--> statement-breakpoint
CREATE INDEX "emitters_cri_idx" ON "flashlight_emitters" USING btree ("cri");--> statement-breakpoint
CREATE UNIQUE INDEX "flashlights_slug_uq" ON "flashlights" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "flashlights_brand_idx" ON "flashlights" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "flashlights_status_idx" ON "flashlights" USING btree ("release_status");--> statement-breakpoint
CREATE INDEX "flashlights_last_event_idx" ON "flashlights" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "flashlights_first_seen_idx" ON "flashlights" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "flashlights_lumens_idx" ON "flashlights" USING btree ("max_lumens");--> statement-breakpoint
CREATE INDEX "flashlights_throw_idx" ON "flashlights" USING btree ("throw_meters");--> statement-breakpoint
CREATE INDEX "flashlights_battery_gin" ON "flashlights" USING gin ("battery_types");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "product_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_flashlight_idx" ON "product_events" USING btree ("flashlight_id");--> statement-breakpoint
CREATE INDEX "events_unprocessed_idx" ON "product_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sources_adapter_idx" ON "sources" USING btree ("adapter_type");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_light_uq" ON "user_collections" USING btree ("user_id","flashlight_id");--> statement-breakpoint
CREATE INDEX "collections_user_status_idx" ON "user_collections" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_external_uq" ON "vendor_listings" USING btree ("source_id","external_product_id");--> statement-breakpoint
CREATE INDEX "listings_flashlight_idx" ON "vendor_listings" USING btree ("flashlight_id");--> statement-breakpoint
CREATE INDEX "listings_url_idx" ON "vendor_listings" USING btree ("product_url");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "vendor_listings" USING btree ("price_usd");