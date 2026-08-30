CREATE TABLE `review_judge_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`createdByUserId` int NOT NULL,
	`invitedEmail` varchar(320),
	`acceptedByUserId` int,
	`status` enum('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_judge_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_judge_invites_token_unique` UNIQUE(`token`)
);
