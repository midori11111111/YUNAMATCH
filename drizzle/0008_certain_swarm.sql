CREATE TABLE `daily_visitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`visitor_key` text NOT NULL,
	`page_views` integer DEFAULT 1 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_visitors_day_visitor` ON `daily_visitors` (`day`,`visitor_key`);--> statement-breakpoint
CREATE INDEX `idx_daily_visitors_day` ON `daily_visitors` (`day`);--> statement-breakpoint
CREATE TABLE `site_visitors` (
	`visitor_key` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_site_visitors_last_seen` ON `site_visitors` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_site_visitors_user` ON `site_visitors` (`user_id`);--> statement-breakpoint
PRAGMA optimize;
