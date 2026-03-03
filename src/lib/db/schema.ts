import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  numeric,
  date,
  index,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ── Enums ── */
export const platformEnum = pgEnum("platform", [
  "meta",
  "tiktok",
  "instagram",
  "youtube",
  "other",
]);

export const statusInspoEnum = pgEnum("status_inspo", [
  "inbox",
  "shortlisted",
  "annotated",
  "briefed",
  "archived",
]);

export const statusProdEnum = pgEnum("status_prod", [
  "in_production",
  "live",
  "killed",
]);

export const triageEnum = pgEnum("triage", ["test", "maybe", "archive"]);

export const assetTypeEnum = pgEnum("asset_type", ["video", "image"]);

export const annotationTypeEnum = pgEnum("annotation_type", [
  "hook",
  "structure",
  "mechanism",
  "offer",
  "proof",
  "objection",
  "cta",
  "visual",
  "voice",
  "other",
]);

export const verdictEnum = pgEnum("verdict", ["scale", "iterate", "kill"]);

/* ── Tables ── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inspirations = pgTable(
  "inspirations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull().default("other"),
    sourceUrl: text("source_url"),
    advertiserName: text("advertiser_name"),
    brandTag: text("brand_tag"),
    format: text("format"),
    hookType: text("hook_type"),
    angle: text("angle"),
    triage: triageEnum("triage"),
    status: statusInspoEnum("status").notNull().default("inbox"),
    whySaved: text("why_saved").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_inspo_status_created").on(table.status, table.createdAt),
    index("idx_inspo_platform").on(table.platform),
  ]
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inspirationId: uuid("inspiration_id")
      .references(() => inspirations.id, { onDelete: "cascade" })
      .notNull(),
    type: assetTypeEnum("type").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    durationSeconds: integer("duration_seconds"),
    width: integer("width"),
    height: integer("height"),
    thumbnailR2Key: text("thumbnail_r2_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_assets_inspo").on(table.inspirationId)]
);

export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inspirationId: uuid("inspiration_id")
      .references(() => inspirations.id, { onDelete: "cascade" })
      .notNull(),
    timestampMs: integer("timestamp_ms"),
    pinX: numeric("pin_x", { precision: 6, scale: 4 }),
    pinY: numeric("pin_y", { precision: 6, scale: 4 }),
    type: annotationTypeEnum("type").notNull(),
    text: text("text"),
    audioR2Key: text("audio_r2_key"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_annotations_inspo_ts").on(table.inspirationId, table.timestampMs),
  ]
);

export const producedAds = pgTable(
  "produced_ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inspirationId: uuid("inspiration_id")
      .references(() => inspirations.id, { onDelete: "cascade" })
      .notNull(),
    internalName: text("internal_name").notNull(),
    publicName: text("public_name").notNull(),
    scriptUrl: text("script_url"),
    editor: text("editor"),
    status: statusProdEnum("status").notNull().default("in_production"),
    platform: platformEnum("platform"),
    liveDate: date("live_date"),
    campaign: text("campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_prod_status").on(table.status),
    index("idx_prod_inspo").on(table.inspirationId),
    uniqueIndex("idx_prod_internal_name").on(table.internalName),
  ]
);

export const hooks = pgTable(
  "hooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    producedAdId: uuid("produced_ad_id")
      .references(() => producedAds.id, { onDelete: "cascade" })
      .notNull(),
    hookNumber: integer("hook_number").notNull(),
    hookText: text("hook_text").notNull(),
    creativeDirection: text("creative_direction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_hooks_prod_num").on(table.producedAdId, table.hookNumber),
  ]
);

export const performanceLogs = pgTable(
  "performance_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    producedAdId: uuid("produced_ad_id")
      .references(() => producedAds.id, { onDelete: "cascade" })
      .notNull(),
    dateStart: date("date_start"),
    dateEnd: date("date_end"),
    spend: numeric("spend", { precision: 12, scale: 2 }),
    purchases: integer("purchases"),
    revenue: numeric("revenue", { precision: 12, scale: 2 }),
    cpa: numeric("cpa", { precision: 12, scale: 2 }),
    ctr: numeric("ctr", { precision: 6, scale: 4 }),
    cvr: numeric("cvr", { precision: 6, scale: 4 }),
    verdict: verdictEnum("verdict").notNull(),
    learning: text("learning").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_perf_prod_date").on(table.producedAdId, table.dateEnd),
  ]
);

/* ── Type exports ── */
export type User = typeof users.$inferSelect;
export type Inspiration = typeof inspirations.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Annotation = typeof annotations.$inferSelect;
export type ProducedAd = typeof producedAds.$inferSelect;
export type Hook = typeof hooks.$inferSelect;
export type PerformanceLog = typeof performanceLogs.$inferSelect;
