CREATE TABLE `mutual_like_matches` (
	`pair_key` text PRIMARY KEY NOT NULL,
	`user_low_id` text NOT NULL,
	`user_high_id` text NOT NULL,
	`connection_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mutual_like_matches_connection` ON `mutual_like_matches` (`connection_id`);--> statement-breakpoint
PRAGMA optimize;
