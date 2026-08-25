CREATE TABLE `service_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`user_a_profile_id` integer NOT NULL,
	`user_b_profile_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`user_a_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_service_connections_service_created` ON `service_connections` (`service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_connections_user_a` ON `service_connections` (`user_a_profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_connections_user_b` ON `service_connections` (`user_b_profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`connection_id` integer NOT NULL,
	`sender_profile_id` integer NOT NULL,
	`client_id` text NOT NULL,
	`body` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `service_connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_messages_sender_client` ON `service_messages` (`sender_profile_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_service_messages_connection_created` ON `service_messages` (`connection_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_messages_service_created` ON `service_messages` (`service_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`game_identity` text DEFAULT '' NOT NULL,
	`skill_tier` text DEFAULT '' NOT NULL,
	`roles` text DEFAULT '[]' NOT NULL,
	`play_times` text DEFAULT '[]' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`terms_version` text NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`suspended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_profiles_service_user` ON `service_profiles` (`service_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_service_profiles_service_status_updated` ON `service_profiles` (`service_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `service_recruits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`owner_profile_id` integer NOT NULL,
	`mode` text NOT NULL,
	`party_size` integer NOT NULL,
	`desired_roles` text DEFAULT '[]' NOT NULL,
	`start_at` integer,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_service_recruits_service_status_created` ON `service_recruits` (`service_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_recruits_owner_created` ON `service_recruits` (`owner_profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` text NOT NULL,
	`reporter_profile_id` integer NOT NULL,
	`target_profile_id` integer NOT NULL,
	`connection_id` integer,
	`message_id` integer,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`reported_content` text DEFAULT '' NOT NULL,
	`conversation_context` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`reporter_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_profile_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `service_connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `service_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_service_reports_service_status_created` ON `service_reports` (`service_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_service_reports_target_created` ON `service_reports` (`target_profile_id`,`created_at`);