CREATE TABLE `account_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`canonical_user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`display_name` text,
	`email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_links_provider_account` ON `account_links` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `idx_account_links_canonical_user` ON `account_links` (`canonical_user_id`);--> statement-breakpoint
PRAGMA optimize;
