import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  trainerName: text("trainer_name").notNull(),
  mainPokemon: text("main_pokemon").notNull(),
  highestRate: text("highest_rate").notNull(),
  playTime: text("play_time").notNull(),
  gender: text("gender").notNull(),
  contact: text("contact").notNull(),
  authProvider: text("auth_provider").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

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
  applicantContact: text("applicant_contact").notNull().default(""),
  pokemon: text("pokemon").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_applications_recruit_applicant").on(table.recruitId, table.applicantId)]);

export const connections = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull().references(() => applications.id),
  recruitId: integer("recruit_id").notNull().references(() => recruits.id),
  userAId: text("user_a_id").notNull(),
  userBId: text("user_b_id").notNull(),
  userAName: text("user_a_name").notNull(),
  userBName: text("user_b_name").notNull(),
  userAPokemon: text("user_a_pokemon").notNull(),
  userBPokemon: text("user_b_pokemon").notNull(),
  userAContact: text("user_a_contact").notNull(),
  userBContact: text("user_b_contact").notNull(),
  userAAgain: integer("user_a_again", { mode: "boolean" }).notNull().default(false),
  userBAgain: integer("user_b_again", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_connections_application").on(table.applicationId),
  index("idx_connections_user_a_created").on(table.userAId, table.createdAt),
  index("idx_connections_user_b_created").on(table.userBId, table.createdAt),
]);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  connectionId: integer("connection_id").notNull().references(() => connections.id),
  senderId: text("sender_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_messages_connection_created").on(table.connectionId, table.createdAt)]);

export const blocks = sqliteTable("blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_blocks_pair").on(table.blockerId, table.blockedId),
  index("idx_blocks_blocked").on(table.blockedId),
]);

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  recruitId: integer("recruit_id"),
  connectionId: integer("connection_id"),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_reports_status_created").on(table.status, table.createdAt),
  index("idx_reports_reporter_created").on(table.reporterId, table.createdAt),
]);
