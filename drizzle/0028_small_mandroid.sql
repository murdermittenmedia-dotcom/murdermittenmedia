CREATE TABLE `golden_wheel_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerEmail` varchar(256) NOT NULL,
	`stripeCustomerId` varchar(256),
	`stripeCheckoutSessionId` varchar(256) NOT NULL,
	`stripePaymentIntentId` varchar(256),
	`paymentStatus` enum('pending','paid','failed','refunded','disputed') NOT NULL DEFAULT 'pending',
	`livemode` boolean NOT NULL DEFAULT false,
	`totalCents` int NOT NULL DEFAULT 0,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`paidAt` timestamp,
	`refundedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `golden_wheel_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `golden_wheel_orders_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `processed_stripe_events` (
	`stripeEventId` varchar(256) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processed_stripe_events_stripeEventId` PRIMARY KEY(`stripeEventId`)
);
--> statement-breakpoint
CREATE TABLE `wheel_eligibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderId` int NOT NULL,
	`stripeCheckoutSessionId` varchar(256) NOT NULL,
	`status` enum('ELIGIBLE','CLAIMED','REVOKED') NOT NULL DEFAULT 'ELIGIBLE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `wheel_eligibility_id` PRIMARY KEY(`id`),
	CONSTRAINT `wheel_eligibility_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `wheel_eligibility_orderId_unique` UNIQUE(`orderId`),
	CONSTRAINT `wheel_eligibility_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `wheel_prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`weight` int NOT NULL DEFAULT 10,
	`enabled` boolean NOT NULL DEFAULT true,
	`rewardType` enum('stripe_coupon','promo_service','physical_item','cash_prize') NOT NULL,
	`rewardValue` varchar(256),
	`inventoryLimit` int,
	`remainingInventory` int,
	`couponExpiryDays` int DEFAULT 90,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wheel_prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wheel_spins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eligibilityId` int NOT NULL,
	`orderId` int NOT NULL,
	`prizeId` int NOT NULL,
	`prizeNameSnapshot` varchar(256) NOT NULL,
	`couponCode` varchar(128),
	`stripeCouponId` varchar(256),
	`status` enum('pending_redemption','redeemed','flagged','revoked') NOT NULL DEFAULT 'pending_redemption',
	`manuallyRedeemed` boolean NOT NULL DEFAULT false,
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wheel_spins_id` PRIMARY KEY(`id`),
	CONSTRAINT `wheel_spins_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `wheel_spins_eligibilityId_unique` UNIQUE(`eligibilityId`),
	CONSTRAINT `wheel_spins_orderId_unique` UNIQUE(`orderId`)
);
