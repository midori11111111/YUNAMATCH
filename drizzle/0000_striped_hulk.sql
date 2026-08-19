CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recruit_id` integer NOT NULL,
	`applicant_id` text NOT NULL,
	`applicant_name` text NOT NULL,
	`pokemon` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recruit_id`) REFERENCES `recruits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recruits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`trainer_name` text NOT NULL,
	`gender` text NOT NULL,
	`pokemon` text NOT NULL,
	`role` text NOT NULL,
	`matches` integer NOT NULL,
	`win_rate` real NOT NULL,
	`rank` text NOT NULL,
	`play_time` text NOT NULL,
	`note` text NOT NULL,
	`contact` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
