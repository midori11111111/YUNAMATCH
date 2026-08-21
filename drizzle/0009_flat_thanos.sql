CREATE TABLE `rate_limit_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`reset_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_buckets_reset` ON `rate_limit_buckets` (`reset_at`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`trainer_name` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_support_tickets_status_created` ON `support_tickets` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_support_tickets_user_created` ON `support_tickets` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `reports` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;