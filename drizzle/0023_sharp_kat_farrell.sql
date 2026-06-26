CREATE TABLE `cashout_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coins` int NOT NULL,
	`usdEstimate` int NOT NULL,
	`paymentMethod` enum('cashapp','paypal','venmo','zelle') NOT NULL,
	`paymentHandle` varchar(128) NOT NULL,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(512),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cashout_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coin_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`totalEarned` int NOT NULL DEFAULT 0,
	`totalSpent` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coin_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `coin_balances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `coin_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`coins` int NOT NULL,
	`bonusCoins` int NOT NULL DEFAULT 0,
	`priceCents` int NOT NULL,
	`badge` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coin_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coin_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coins` int NOT NULL,
	`amountCents` int NOT NULL,
	`paymentMethod` varchar(64),
	`paymentNote` varchar(256),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvedByAdminId` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coin_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creator_cashouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountCents` int NOT NULL,
	`paymentMethod` enum('cashapp','paypal','applepay') NOT NULL,
	`paymentHandle` varchar(128) NOT NULL,
	`status` enum('pending','approved','paid','on_hold','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(512),
	`processedAt` timestamp,
	`processedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_cashouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_spins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prizeKey` varchar(64) NOT NULL,
	`prizeLabel` varchar(128) NOT NULL,
	`spinDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_spins_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_spins_user_day_unique` UNIQUE(`userId`,`spinDate`)
);
--> statement-breakpoint
CREATE TABLE `economy_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorSplitPct` int NOT NULL DEFAULT 70,
	`platformSplitPct` int NOT NULL DEFAULT 30,
	`fireVoteConversionEnabled` boolean NOT NULL DEFAULT true,
	`fireVotesPerConversion` int NOT NULL DEFAULT 50,
	`coinsPerConversion` int NOT NULL DEFAULT 10,
	`fvDailyCoinCap` int NOT NULL DEFAULT 100,
	`fvWeeklyCoinCap` int NOT NULL DEFAULT 500,
	`fvMonthlyCoinCap` int NOT NULL DEFAULT 2000,
	`minCashoutCents` int NOT NULL DEFAULT 500,
	`cashAppEnabled` boolean NOT NULL DEFAULT true,
	`paypalEnabled` boolean NOT NULL DEFAULT true,
	`applePayEnabled` boolean NOT NULL DEFAULT true,
	`fraudAutoFreezeEnabled` boolean NOT NULL DEFAULT true,
	`fraudRapidGiftThreshold` int NOT NULL DEFAULT 10,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `economy_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fire_trash_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`submissionId` int NOT NULL,
	`vote` enum('fire','trash') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fire_trash_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fire_vote_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`lifetimeEarned` int NOT NULL DEFAULT 0,
	`lifetimeConverted` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fire_vote_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `fire_vote_balances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fire_vote_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fireVotesBurned` int NOT NULL,
	`coinsAwarded` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fire_vote_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fraud_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`riskScore` enum('low','medium','high','critical') NOT NULL,
	`details` text,
	`ipAddress` varchar(64),
	`deviceFingerprint` varchar(128),
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`resolvedNote` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gift_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`description` varchar(256),
	`coinCost` int NOT NULL,
	`usdValueCents` int NOT NULL,
	`rarity` enum('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'common',
	`animationType` varchar(64) NOT NULL DEFAULT 'float',
	`soundEffect` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`isLimitedTime` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gift_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liveStreamId` int NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int NOT NULL,
	`giftTypeId` int NOT NULL,
	`coinCost` int NOT NULL,
	`usdValueCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `judge_streams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`musicReviewSessionId` int,
	`roomName` varchar(128) NOT NULL,
	`ingressId` varchar(256) NOT NULL,
	`rtmpUrl` varchar(512) NOT NULL,
	`rtmpKey` varchar(256) NOT NULL,
	`status` enum('active','ended','error') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `judge_streams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_skip_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_skip_credits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`available` int NOT NULL DEFAULT 0,
	`pending` int NOT NULL DEFAULT 0,
	`lifetimeEarned` int NOT NULL DEFAULT 0,
	`lifetimeWithdrawn` int NOT NULL DEFAULT 0,
	`isFrozen` boolean NOT NULL DEFAULT false,
	`frozenReason` varchar(256),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_rewards_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_rewards_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`streamTitle` varchar(256) DEFAULT 'Live Stream',
	`youtubeUrl` varchar(512),
	`isActive` boolean NOT NULL DEFAULT true,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`peakViewers` int NOT NULL DEFAULT 0,
	`totalViewerMinutes` int NOT NULL DEFAULT 0,
	`viewerSnapshots` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_streams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`status` enum('live','ended') NOT NULL DEFAULT 'live',
	`livekitRoomName` varchar(128) NOT NULL,
	`ingressId` varchar(256),
	`rtmpUrl` varchar(512),
	`rtmpKey` varchar(256),
	`viewerCount` int NOT NULL DEFAULT 0,
	`peakViewerCount` int NOT NULL DEFAULT 0,
	`totalGiftCoins` int NOT NULL DEFAULT 0,
	`totalGiftUsd` int NOT NULL DEFAULT 0,
	`payoutStatus` enum('pending','paid') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `live_streams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `music_review_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_review_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(128) NOT NULL,
	`body` varchar(512) NOT NULL,
	`link` varchar(256),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reward_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rewardId` int,
	`action` varchar(64) NOT NULL,
	`performedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reward_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`type` enum('level','achievement','promo','wars','review','supporter','verified','rare') NOT NULL DEFAULT 'achievement',
	`rarity` enum('common','rare','epic','legendary','hall_of_fame') NOT NULL DEFAULT 'common',
	`requirements` text NOT NULL DEFAULT ('{}'),
	`requiresAdminApproval` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`isPaused` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp,
	`badgeIcon` varchar(64),
	`badgeColor` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stream_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`sessionId` int,
	`streamTitle` varchar(256) DEFAULT 'Live Stream',
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp NOT NULL,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`totalViews` int NOT NULL DEFAULT 0,
	`peakViewers` int NOT NULL DEFAULT 0,
	`avgViewers` int NOT NULL DEFAULT 0,
	`totalGifts` int NOT NULL DEFAULT 0,
	`totalCoinsGifted` int NOT NULL DEFAULT 0,
	`totalLiveRewards` int NOT NULL DEFAULT 0,
	`totalFireVotes` int NOT NULL DEFAULT 0,
	`totalLikes` int NOT NULL DEFAULT 0,
	`newFollowers` int NOT NULL DEFAULT 0,
	`topGifters` text,
	`giftBreakdown` text,
	`likeBreakdown` text,
	`engagementSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stream_summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badge` varchar(64) NOT NULL,
	`label` varchar(64),
	`rarity` enum('common','rare','epic','legendary','hall_of_fame') NOT NULL DEFAULT 'common',
	`badgeIcon` varchar(64),
	`badgeColor` varchar(32),
	`isVisible` boolean NOT NULL DEFAULT true,
	`grantedBy` int,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `user_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rewardId` int NOT NULL,
	`status` enum('locked','unlocked','claimable','active','redeemed','expired','revoked') NOT NULL DEFAULT 'locked',
	`unlockedAt` timestamp,
	`claimedAt` timestamp,
	`redeemedAt` timestamp,
	`revokedAt` timestamp,
	`grantedBy` int,
	`earnedVia` varchar(256),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` enum('coins','fire_votes','live_rewards') NOT NULL,
	`type` varchar(64) NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`referenceId` int,
	`referenceType` varchar(64),
	`note` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`reason` varchar(128) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xp_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `musicReviewSessionId` int;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `isPaidSubmission` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `paidSubmissionType` enum('reentry5','reentry10','skip');--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `paidSubmissionConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accountLabels` text;--> statement-breakpoint
ALTER TABLE `users` ADD `xp` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `fanXP` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `level` varchar(32) DEFAULT 'bronze' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `fanLevel` varchar(32) DEFAULT 'supporter' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `streak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastActiveDate` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `cashappPaymentReceiptUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `judgeVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `accountLabel`;