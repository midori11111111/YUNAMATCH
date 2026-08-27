PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`trainer_name` text NOT NULL,
	`main_pokemon` text NOT NULL,
	`highest_rate` text NOT NULL,
	`play_time` text NOT NULL,
	`gender` text NOT NULL,
	`contact` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text DEFAULT '' NOT NULL,
	`header_url` text DEFAULT '' NOT NULL,
	`age` integer,
	`age_confirmed` integer DEFAULT false NOT NULL,
	`read_receipts_enabled` integer DEFAULT false NOT NULL,
	`terms_accepted_at` integer,
	`suspended_at` integer,
	`auth_provider` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("user_id", "trainer_name", "main_pokemon", "highest_rate", "play_time", "gender", "contact", "bio", "avatar_url", "header_url", "age", "age_confirmed", "read_receipts_enabled", "terms_accepted_at", "suspended_at", "auth_provider", "created_at", "updated_at") SELECT "user_id", "trainer_name", "main_pokemon", "highest_rate", "play_time", "gender", "contact", "bio", "avatar_url", "header_url", "age", "age_confirmed", "read_receipts_enabled", "terms_accepted_at", "suspended_at", "auth_provider", "created_at", "updated_at" FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
UPDATE `profiles` SET `read_receipts_enabled` = false;--> statement-breakpoint
PRAGMA foreign_keys=ON;
