CREATE TABLE `beat_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`contractNumber` varchar(96) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`documentUrl` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `beat_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_contracts_saleId_unique` UNIQUE(`saleId`),
	CONSTRAINT `beat_contracts_contractNumber_unique` UNIQUE(`contractNumber`)
);
--> statement-breakpoint
CREATE TABLE `beat_licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`beatId` int NOT NULL,
	`code` enum('basic','premium','exclusive') NOT NULL,
	`name` varchar(96) NOT NULL,
	`priceCents` int NOT NULL,
	`terms` text NOT NULL,
	`includesStems` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `beat_payout_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`producerId` int NOT NULL,
	`amountCents` int NOT NULL,
	`paymentMethod` enum('cashapp','paypal','zelle') NOT NULL,
	`paymentHandle` varchar(256) NOT NULL,
	`status` enum('pending','approved','paid','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(512),
	`processedAt` timestamp,
	`processedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_payout_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `beat_producer_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCheckoutSessionId` varchar(256),
	`stripeSubscriptionId` varchar(256),
	`status` enum('active','past_due','canceled','inactive') NOT NULL DEFAULT 'inactive',
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_producer_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_producer_memberships_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `beat_producer_memberships_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`),
	CONSTRAINT `beat_producer_memberships_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
--> statement-breakpoint
CREATE TABLE `beat_producer_payout_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeConnectAccountId` varchar(256),
	`payoutStatus` enum('not_started','pending','active','restricted') NOT NULL DEFAULT 'not_started',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_producer_payout_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_producer_payout_profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `beat_producer_payout_profiles_stripeConnectAccountId_unique` UNIQUE(`stripeConnectAccountId`)
);
--> statement-breakpoint
CREATE TABLE `beat_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`beatId` int NOT NULL,
	`licenseId` int NOT NULL,
	`buyerId` int NOT NULL,
	`producerId` int NOT NULL,
	`buyerName` varchar(160) NOT NULL,
	`buyerEmail` varchar(320),
	`beatTitleSnapshot` varchar(160) NOT NULL,
	`producerNameSnapshot` varchar(160) NOT NULL,
	`licenseNameSnapshot` varchar(96) NOT NULL,
	`licenseTermsSnapshot` text NOT NULL,
	`masterFileKeySnapshot` varchar(512) NOT NULL,
	`amountCents` int NOT NULL,
	`platformFeeCents` int NOT NULL,
	`producerEarningsCents` int NOT NULL,
	`stripeCheckoutSessionId` varchar(256) NOT NULL,
	`stripePaymentIntentId` varchar(256),
	`status` enum('pending','paid','refunded','disputed') NOT NULL DEFAULT 'pending',
	`contractId` int,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_sales_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_beats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`producerId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(160) NOT NULL,
	`genre` varchar(80) NOT NULL,
	`bpm` int,
	`musicalKey` varchar(24),
	`mood` varchar(120),
	`description` text,
	`tags` text,
	`artworkUrl` varchar(512),
	`previewFileKey` varchar(512) NOT NULL,
	`previewFileUrl` varchar(512) NOT NULL,
	`masterFileKey` varchar(512) NOT NULL,
	`masterFileUrl` varchar(512) NOT NULL,
	`status` enum('draft','active','archived','sold_exclusive') NOT NULL DEFAULT 'draft',
	`featured` boolean NOT NULL DEFAULT false,
	`salesCount` int NOT NULL DEFAULT 0,
	`exclusiveSoldAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_beats_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_beats_slug_unique` UNIQUE(`slug`)
);
