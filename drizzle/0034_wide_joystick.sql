CREATE TABLE `availability_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`match_type` text NOT NULL,
	`visibility` text DEFAULT 'mates' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_availability_slots_user_day` ON `availability_slots` (`user_id`,`day`);