CREATE TABLE `lobbies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recruit_id` integer NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'forming' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`recruit_id`) REFERENCES `recruits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lobbies_recruit` ON `lobbies` (`recruit_id`);--> statement-breakpoint
CREATE INDEX `idx_lobbies_owner_status` ON `lobbies` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `lobby_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lobby_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`application_id` integer,
	`connection_id` integer,
	`trainer_name` text NOT NULL,
	`pokemon` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lobby_members_lobby_user` ON `lobby_members` (`lobby_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_lobby_members_user_status` ON `lobby_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`connection_id` integer,
	`typing` integer DEFAULT false NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`subscription` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
ALTER TABLE `connections` ADD `user_a_last_read_at` integer;--> statement-breakpoint
ALTER TABLE `connections` ADD `user_b_last_read_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `age_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `terms_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `suspended_at` integer;--> statement-breakpoint
ALTER TABLE `recruits` ADD `start_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recruits` ADD `expires_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recruits` ADD `party_size` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `recruits` ADD `desired_pokemon` text DEFAULT 'すべて' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruits` ADD `desired_role` text DEFAULT '指定なし' NOT NULL;--> statement-breakpoint
ALTER TABLE `recruits` ADD `accepted_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_recruits_status_expires` ON `recruits` (`status`,`expires_at`);
--> statement-breakpoint
PRAGMA optimize;
