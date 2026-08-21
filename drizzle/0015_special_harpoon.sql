ALTER TABLE `messages` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_sender_client` ON `messages` (`sender_id`,`client_id`);