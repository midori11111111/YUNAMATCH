CREATE TABLE `connection_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer NOT NULL,
	`rater_id` text NOT NULL,
	`rated_user_id` text NOT NULL,
	`score` integer NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connection_ratings_connection_rater` ON `connection_ratings` (`connection_id`,`rater_id`);--> statement-breakpoint
CREATE INDEX `idx_connection_ratings_rated_user` ON `connection_ratings` (`rated_user_id`);--> statement-breakpoint
PRAGMA optimize;
