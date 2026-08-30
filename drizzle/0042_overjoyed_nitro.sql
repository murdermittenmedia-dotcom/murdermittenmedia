CREATE TABLE `review_plus_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCheckoutSessionId` varchar(255) NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`status` enum('active','expired','canceled') NOT NULL DEFAULT 'active',
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_plus_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_plus_memberships_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
