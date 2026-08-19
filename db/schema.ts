import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const recruits = sqliteTable("recruits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  trainerName: text("trainer_name").notNull(),
  gender: text("gender").notNull(),
  pokemon: text("pokemon").notNull(),
  role: text("role").notNull(),
  matches: integer("matches").notNull(),
  winRate: real("win_rate").notNull(),
  rank: text("rank").notNull(),
  playTime: text("play_time").notNull(),
  note: text("note").notNull(),
  contact: text("contact").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_recruits_status_created").on(table.status, table.createdAt)]);

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recruitId: integer("recruit_id").notNull().references(() => recruits.id),
  applicantId: text("applicant_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  pokemon: text("pokemon").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_applications_recruit_applicant").on(table.recruitId, table.applicantId)]);
