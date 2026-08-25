CREATE TABLE `service_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`sender_profile_id` integer NOT NULL,
	`recipient_profile_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sender_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_likes_service_pair` ON `service_likes` (`service_id`,`sender_profile_id`,`recipient_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_service_likes_recipient_status_created` ON `service_likes` (`service_id`,`recipient_profile_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `service_connections` ADD `requester_profile_id` integer NOT NULL REFERENCES service_profiles(id);