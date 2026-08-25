CREATE TABLE `service_admin_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`action` text NOT NULL,
	`target_profile_id` integer,
	`report_id` integer,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_service_admin_audit_service_created` ON `service_admin_audit_logs` (`service_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`blocker_profile_id` integer NOT NULL,
	`blocked_profile_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`blocker_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_blocks_service_pair` ON `service_blocks` (`service_id`,`blocker_profile_id`,`blocked_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_service_blocks_blocker_created` ON `service_blocks` (`blocker_profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_blocks_blocked_created` ON `service_blocks` (`blocked_profile_id`,`created_at`);