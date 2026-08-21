CREATE TABLE `profile_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_likes_sender_recipient` ON `profile_likes` (`sender_id`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `idx_profile_likes_recipient_created` ON `profile_likes` (`recipient_id`,`created_at`);