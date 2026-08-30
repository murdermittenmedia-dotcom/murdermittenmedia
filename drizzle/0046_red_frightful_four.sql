ALTER TABLE `review_submissions` ADD `verdict` varchar(64);--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `crowdFirePct` int;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `crowdTrashPct` int;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `judgeFireCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `judgeTrashCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `totalVoteCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `skipVoteTriggered` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `reviewedAt` timestamp;