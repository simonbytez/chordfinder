import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Category, Difficulty, Instrument } from "../lib/constants";

export const drumscrollTranscriptions = pgTable(
  "drumscroll_transcriptions",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    artistOrCorps: text("artist_or_corps").notNull().default("Unknown"),
    instrument: text("instrument").$type<Instrument>().notNull(),
    category: text("category").$type<Category>().notNull(),
    difficulty: text("difficulty").$type<Difficulty>().notNull(),
    difficultyOverridden: boolean("difficulty_overridden").notNull().default(false),
    pageCount: integer("page_count").notNull().default(1),
    sourceUrl: text("source_url").notNull(),
    pdfUrl: text("pdf_url").notNull(),
    previewImageUrl: text("preview_image_url"),
    bookmarked: boolean("bookmarked").notNull().default(false),
    sourceSite: text("source_site").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("drumscroll_transcriptions_pdf_url_idx").on(table.pdfUrl),
    index("drumscroll_transcriptions_filters_idx").on(
      table.instrument,
      table.category,
      table.difficulty,
      table.bookmarked,
    ),
  ],
);

export const drumscrollSources = pgTable("drumscroll_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  instrument: text("instrument").$type<Instrument>().notNull(),
  defaultCategory: text("default_category").$type<Category>().notNull(),
  description: text("description").notNull().default(""),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status").notNull().default("idle"),
  itemCount: integer("item_count").notNull().default(0),
  lastError: text("last_error"),
});

export type TranscriptionRow = typeof drumscrollTranscriptions.$inferSelect;
export type NewTranscriptionRow = typeof drumscrollTranscriptions.$inferInsert;
export type SourceRow = typeof drumscrollSources.$inferSelect;
export type NewSourceRow = typeof drumscrollSources.$inferInsert;
