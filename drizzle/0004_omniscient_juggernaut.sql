CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`trainer_name` text NOT NULL,
	`main_pokemon` text NOT NULL,
	`highest_rate` text NOT NULL,
	`play_time` text NOT NULL,
	`gender` text NOT NULL,
	`contact` text NOT NULL,
	`auth_provider` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
