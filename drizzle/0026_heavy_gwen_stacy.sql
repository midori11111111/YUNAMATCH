ALTER TABLE `reports` ADD `message_id` integer;--> statement-breakpoint
ALTER TABLE `reports` ADD `reported_content` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `conversation_context` text DEFAULT '[]' NOT NULL;