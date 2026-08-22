CREATE TABLE `notification_dismissals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`notification_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_dismissals_user_key` ON `notification_dismissals` (`user_id`,`notification_key`);