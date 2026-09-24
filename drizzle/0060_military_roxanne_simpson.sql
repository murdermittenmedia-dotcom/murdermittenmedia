CREATE TABLE `beat_pro_trial_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`createdBy` int NOT NULL,
	`status` enum('pending','checkout_started','redeemed','revoked','expired') NOT NULL DEFAULT 'pending',
	`stripeCheckoutSessionId` varchar(256),
	`usedByUserId` int,
	`expiresAt` timestamp NOT NULL,
	`redeemedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_pro_trial_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_pro_trial_invites_token_unique` UNIQUE(`token`),
	CONSTRAINT `beat_pro_trial_invites_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` MODIFY COLUMN `status` enum('trialing','active','past_due','canceled','inactive') NOT NULL DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` ADD `cancelAtPeriodEnd` boolean DEFAULT false NOT NULL;