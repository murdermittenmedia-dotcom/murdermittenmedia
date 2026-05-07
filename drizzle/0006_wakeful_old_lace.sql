CREATE TABLE `song_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`userId` int NOT NULL,
	`reaction` enum('fire','trash') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `song_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `fireCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `trashCount` int DEFAULT 0 NOT NULL;