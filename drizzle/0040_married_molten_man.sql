CREATE TABLE `review_skip_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`musicReviewSessionId` int NOT NULL,
	`submissionId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_skip_votes_id` PRIMARY KEY(`id`)
);
