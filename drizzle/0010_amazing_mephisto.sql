ALTER TABLE `recruits` ADD `kind` text DEFAULT 'timed' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_recruits_kind_status_created` ON `recruits` (`kind`,`status`,`created_at`);