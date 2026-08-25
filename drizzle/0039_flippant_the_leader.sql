ALTER TABLE `service_connections` ADD `pair_key` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_connections_service_pair` ON `service_connections` (`service_id`,`pair_key`);