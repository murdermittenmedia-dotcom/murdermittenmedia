ALTER TABLE `review_occurrences` MODIFY COLUMN `fire` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_occurrences` MODIFY COLUMN `trash` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` MODIFY COLUMN `fireCount` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` MODIFY COLUMN `trashCount` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` MODIFY COLUMN `totalVoteCount` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_occurrences` ADD `adminFire` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_occurrences` ADD `adminTrash` bigint DEFAULT 0 NOT NULL;
