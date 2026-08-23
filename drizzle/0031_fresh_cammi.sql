UPDATE `account_links`
SET `email` = lower(trim(`email`))
WHERE `email` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_account_links_email` ON `account_links` (`email`);
