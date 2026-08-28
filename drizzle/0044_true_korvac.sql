CREATE TABLE `service_message_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`message_id` integer NOT NULL,
	`profile_id` integer NOT NULL,
	`reaction` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `service_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_message_reactions_message_profile` ON `service_message_reactions` (`message_id`,`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_service_message_reactions_message` ON `service_message_reactions` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_service_message_reactions_service_created` ON `service_message_reactions` (`service_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `service_connections` ADD `user_a_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `service_connections` ADD `user_b_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `service_messages` ADD `kind` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_messages` ADD `response` text;--> statement-breakpoint
ALTER TABLE `service_messages` ADD `responded_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_messages_pending_play_invite` ON `service_messages` (`connection_id`) WHERE "service_messages"."kind" = 'play_invite' and "service_messages"."response" is null;