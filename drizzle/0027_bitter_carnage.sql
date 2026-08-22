CREATE TABLE `message_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`connection_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_favorites_user_message` ON `message_favorites` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_message_favorites_user_connection_created` ON `message_favorites` (`user_id`,`connection_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
