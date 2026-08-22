CREATE TABLE `application_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_application_messages_application_created` ON `application_messages` (`application_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `applications` ADD `decision_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
PRAGMA optimize;
