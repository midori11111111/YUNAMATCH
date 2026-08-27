CREATE TABLE `message_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`reaction` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_reactions_message_user` ON `message_reactions` (`message_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_message_reactions_message` ON `message_reactions` (`message_id`);