CREATE TABLE `review_addon_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`stripeSessionId` varchar(255) NOT NULL,
	`kind` enum('skip','full_song','full_song_skip') NOT NULL,
	`amountCents` int NOT NULL,
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_addon_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_addon_payments_stripeSessionId_unique` UNIQUE(`stripeSessionId`)
);
--> statement-breakpoint
CREATE TABLE `review_daily_quotas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(10) NOT NULL,
	`identityHash` varchar(64) NOT NULL,
	`submissions` int NOT NULL DEFAULT 0,
	CONSTRAINT `review_daily_quotas_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_quota_day_identity` UNIQUE(`day`,`identityHash`)
);
--> statement-breakpoint
CREATE TABLE `review_submission_owners` (
	`submissionId` int NOT NULL,
	`deviceHash` varchar(64) NOT NULL,
	CONSTRAINT `review_submission_owners_submissionId` PRIMARY KEY(`submissionId`)
);
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `fullSongRequested` boolean DEFAULT false NOT NULL;