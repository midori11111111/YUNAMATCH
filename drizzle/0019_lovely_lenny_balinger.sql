ALTER TABLE `messages` ADD `kind` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `response` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `responded_at` integer;