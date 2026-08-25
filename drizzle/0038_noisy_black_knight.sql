ALTER TABLE `service_profiles` ADD `age` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `service_profiles` ADD `gender` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_profiles` ADD `show_gender` integer DEFAULT false NOT NULL;