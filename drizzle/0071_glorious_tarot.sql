CREATE TABLE `review_gift_streaks` (
	`id` varchar(128) NOT NULL,
	`unitsSeen` int NOT NULL DEFAULT 0,
	CONSTRAINT `review_gift_streaks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_live_events` (
	`sequence` bigint AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`type` varchar(32) NOT NULL,
	`occurrenceId` varchar(64),
	`submissionId` int,
	`timestampMs` bigint NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT `review_live_events_sequence` PRIMARY KEY(`sequence`),
	CONSTRAINT `review_live_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `review_occurrence_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`occurrenceId` varchar(64) NOT NULL,
	`platform` enum('website','tiktok') NOT NULL,
	`platformUserId` varchar(128) NOT NULL,
	`userId` int,
	`displayName` varchar(128) NOT NULL,
	`reaction` enum('fire','trash') NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	CONSTRAINT `review_occurrence_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_occurrence_platform_user` UNIQUE(`occurrenceId`,`platform`,`platformUserId`)
);
--> statement-breakpoint
CREATE TABLE `review_occurrences` (
	`id` varchar(64) NOT NULL,
	`submissionId` int NOT NULL,
	`startedAtMs` bigint NOT NULL,
	`completedAtMs` bigint,
	`fire` int NOT NULL DEFAULT 0,
	`trash` int NOT NULL DEFAULT 0,
	CONSTRAINT `review_occurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_tiktok_deliveries` (
	`id` varchar(128) NOT NULL,
	`timestampMs` bigint NOT NULL,
	CONSTRAINT `review_tiktok_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `reviewOccurrenceId` varchar(64);