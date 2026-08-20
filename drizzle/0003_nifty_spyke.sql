CREATE TABLE `blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blocks_pair` ON `blocks` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE INDEX `idx_blocks_blocked` ON `blocks` (`blocked_id`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`recruit_id` integer NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`user_a_name` text NOT NULL,
	`user_b_name` text NOT NULL,
	`user_a_pokemon` text NOT NULL,
	`user_b_pokemon` text NOT NULL,
	`user_a_contact` text NOT NULL,
	`user_b_contact` text NOT NULL,
	`user_a_again` integer DEFAULT false NOT NULL,
	`user_b_again` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recruit_id`) REFERENCES `recruits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_application` ON `connections` (`application_id`);--> statement-breakpoint
CREATE INDEX `idx_connections_user_a_created` ON `connections` (`user_a_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_connections_user_b_created` ON `connections` (`user_b_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_connection_created` ON `messages` (`connection_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`recruit_id` integer,
	`connection_id` integer,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reports_reporter_created` ON `reports` (`reporter_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
