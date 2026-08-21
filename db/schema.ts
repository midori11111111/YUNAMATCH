import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  trainerName: text("trainer_name").notNull(),
  mainPokemon: text("main_pokemon").notNull(),
  highestRate: text("highest_rate").notNull(),
  playTime: text("play_time").notNull(),
  gender: text("gender").notNull(),
  contact: text("contact").notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  ageConfirmed: integer("age_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
  suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
  authProvider: text("auth_provider").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const accountLinks = sqliteTable(
  "account_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    canonicalUserId: text("canonical_user_id").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    contactId: text("contact_id").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_account_links_provider_account").on(
      table.provider,
      table.providerAccountId,
    ),
    index("idx_account_links_canonical_user").on(table.canonicalUserId),
  ],
);

export const profileLikes = sqliteTable(
  "profile_likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    senderId: text("sender_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_profile_likes_sender_recipient").on(
      table.senderId,
      table.recipientId,
    ),
    index("idx_profile_likes_recipient_created").on(
      table.recipientId,
      table.createdAt,
    ),
  ],
);

export const recruits = sqliteTable(
  "recruits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull().default("timed"),
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
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull().default(0),
    startTimeUndecided: integer("start_time_undecided", { mode: "boolean" })
      .notNull()
      .default(false),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" })
      .notNull()
      .default(0),
    partySize: integer("party_size").notNull().default(2),
    desiredPokemon: text("desired_pokemon").notNull().default("すべて"),
    desiredRole: text("desired_role").notNull().default("指定なし"),
    acceptedCount: integer("accepted_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_recruits_kind_status_created").on(
      table.kind,
      table.status,
      table.createdAt,
    ),
    index("idx_recruits_status_created").on(table.status, table.createdAt),
    index("idx_recruits_status_expires").on(table.status, table.expiresAt),
  ],
);

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recruitId: integer("recruit_id")
      .notNull()
      .references(() => recruits.id),
    applicantId: text("applicant_id").notNull(),
    applicantName: text("applicant_name").notNull(),
    applicantContact: text("applicant_contact").notNull().default(""),
    pokemon: text("pokemon").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_applications_recruit_applicant").on(
      table.recruitId,
      table.applicantId,
    ),
  ],
);

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id),
    recruitId: integer("recruit_id")
      .notNull()
      .references(() => recruits.id),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    userAName: text("user_a_name").notNull(),
    userBName: text("user_b_name").notNull(),
    userAPokemon: text("user_a_pokemon").notNull(),
    userBPokemon: text("user_b_pokemon").notNull(),
    userAContact: text("user_a_contact").notNull(),
    userBContact: text("user_b_contact").notNull(),
    userAShareContact: integer("user_a_share_contact", { mode: "boolean" })
      .notNull()
      .default(false),
    userBShareContact: integer("user_b_share_contact", { mode: "boolean" })
      .notNull()
      .default(false),
    userAAgain: integer("user_a_again", { mode: "boolean" })
      .notNull()
      .default(false),
    userBAgain: integer("user_b_again", { mode: "boolean" })
      .notNull()
      .default(false),
    userAPlayed: integer("user_a_played", { mode: "boolean" })
      .notNull()
      .default(false),
    userBPlayed: integer("user_b_played", { mode: "boolean" })
      .notNull()
      .default(false),
    userALastReadAt: integer("user_a_last_read_at", { mode: "timestamp_ms" }),
    userBLastReadAt: integer("user_b_last_read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_connections_application").on(table.applicationId),
    index("idx_connections_user_a_created").on(table.userAId, table.createdAt),
    index("idx_connections_user_b_created").on(table.userBId, table.createdAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    connectionId: integer("connection_id")
      .notNull()
      .references(() => connections.id),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_messages_connection_created").on(
      table.connectionId,
      table.createdAt,
    ),
  ],
);

export const blocks = sqliteTable(
  "blocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_blocks_pair").on(table.blockerId, table.blockedId),
    index("idx_blocks_blocked").on(table.blockedId),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reporterId: text("reporter_id").notNull(),
    targetId: text("target_id").notNull(),
    recruitId: integer("recruit_id"),
    connectionId: integer("connection_id"),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_reports_status_created").on(table.status, table.createdAt),
    index("idx_reports_reporter_created").on(table.reporterId, table.createdAt),
  ],
);

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    trainerName: text("trainer_name").notNull(),
    category: text("category").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_support_tickets_status_created").on(
      table.status,
      table.createdAt,
    ),
    index("idx_support_tickets_user_created").on(table.userId, table.createdAt),
  ],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    resetAt: integer("reset_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_rate_limit_buckets_reset").on(table.resetAt)],
);

export const lobbies = sqliteTable(
  "lobbies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recruitId: integer("recruit_id")
      .notNull()
      .references(() => recruits.id),
    ownerId: text("owner_id").notNull(),
    status: text("status").notNull().default("forming"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("idx_lobbies_recruit").on(table.recruitId),
    index("idx_lobbies_owner_status").on(table.ownerId, table.status),
  ],
);

export const lobbyMembers = sqliteTable(
  "lobby_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lobbyId: integer("lobby_id")
      .notNull()
      .references(() => lobbies.id),
    userId: text("user_id").notNull(),
    applicationId: integer("application_id").references(() => applications.id),
    connectionId: integer("connection_id").references(() => connections.id),
    trainerName: text("trainer_name").notNull(),
    pokemon: text("pokemon").notNull(),
    contact: text("contact").notNull().default(""),
    ready: integer("ready", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_lobby_members_lobby_user").on(table.lobbyId, table.userId),
    index("idx_lobby_members_user_status").on(table.userId, table.status),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    subscription: text("subscription").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_push_subscriptions_endpoint").on(table.endpoint),
    index("idx_push_subscriptions_user").on(table.userId),
  ],
);

export const presence = sqliteTable("presence", {
  userId: text("user_id").primaryKey(),
  connectionId: integer("connection_id"),
  typing: integer("typing", { mode: "boolean" }).notNull().default(false),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
});

export const siteVisitors = sqliteTable(
  "site_visitors",
  {
    visitorKey: text("visitor_key").primaryKey(),
    userId: text("user_id"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    visitCount: integer("visit_count").notNull().default(1),
  },
  (table) => [
    index("idx_site_visitors_last_seen").on(table.lastSeenAt),
    index("idx_site_visitors_user").on(table.userId),
  ],
);

export const dailyVisitors = sqliteTable(
  "daily_visitors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    day: text("day").notNull(),
    visitorKey: text("visitor_key").notNull(),
    pageViews: integer("page_views").notNull().default(1),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_daily_visitors_day_visitor").on(
      table.day,
      table.visitorKey,
    ),
    index("idx_daily_visitors_day").on(table.day),
  ],
);
