CREATE TABLE `recruit_alerts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recruit_alerts_enabled` ON `recruit_alerts` (`enabled`);
--> statement-breakpoint
PRAGMA optimize;
