CREATE TABLE `beat_pro_trial_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviteId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('checkout_started','redeemed','cancelled') NOT NULL DEFAULT 'checkout_started',
	`stripeCheckoutSessionId` varchar(256),
	`stripeSubscriptionId` varchar(256),
	`redeemedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_pro_trial_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_pro_trial_redemptions_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `beat_pro_trial_redemptions_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`),
	CONSTRAINT `beat_pro_trial_redemptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
