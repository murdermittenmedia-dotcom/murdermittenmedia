CREATE TABLE `review_submission_recovery_tokens` (
	`submissionId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	CONSTRAINT `review_submission_recovery_tokens_submissionId` PRIMARY KEY(`submissionId`),
	CONSTRAINT `review_submission_recovery_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `review_bridge_devices` (
	`id` varchar(36) NOT NULL,
	`pairingHash` varchar(64),
	`pairingExpiresAtMs` bigint,
	`credentialCiphertext` text,
	`deviceLabel` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`testMode` boolean NOT NULL DEFAULT false,
	`streamId` varchar(36) NOT NULL,
	`roomId` varchar(30) NOT NULL,
	`fireCommand` varchar(32) NOT NULL DEFAULT '!fire',
	`trashCommand` varchar(32) NOT NULL DEFAULT '!trash',
	`galaxyGiftId` varchar(64),
	`localConnected` boolean NOT NULL DEFAULT false,
	`lastHeartbeatMs` bigint,
	`lastLiveEventMs` bigint,
	`lastTestEventMs` bigint,
	`createdAtMs` bigint NOT NULL,
	`createdByUserId` int NOT NULL,
	CONSTRAINT `review_bridge_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_bridge_nonces` (
	`id` varchar(64) NOT NULL,
	`timestampMs` bigint NOT NULL,
	CONSTRAINT `review_bridge_nonces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_bridge_receipts` (
	`id` varchar(64) NOT NULL,
	`bridgeId` varchar(36) NOT NULL,
	`streamId` varchar(36) NOT NULL,
	`eventKind` varchar(16) NOT NULL,
	`actor` varchar(128),
	`giftId` varchar(64),
	`giftName` varchar(100),
	`outcome` varchar(100) NOT NULL,
	`testMode` boolean NOT NULL DEFAULT false,
	`timestampMs` bigint NOT NULL,
	CONSTRAINT `review_bridge_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_galaxy_redemptions` (
	`id` varchar(64) NOT NULL,
	`bridgeId` varchar(36) NOT NULL,
	`streamId` varchar(36) NOT NULL,
	`providerUserId` varchar(128) NOT NULL,
	`actor` varchar(128) NOT NULL,
	`giftId` varchar(64) NOT NULL,
	`unit` int NOT NULL,
	`submissionId` int,
	`status` varchar(32) NOT NULL DEFAULT 'awaiting_admin',
	`receivedAtMs` bigint NOT NULL,
	`redeemedAtMs` bigint,
	`reviewedByUserId` int,
	`auditNote` varchar(500),
	CONSTRAINT `review_galaxy_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_galaxy_stream_submission` UNIQUE(`streamId`,`submissionId`)
);
--> statement-breakpoint
CREATE TABLE `review_tiktok_link_codes` (
	`codeHash` varchar(64) NOT NULL,
	`submissionId` int NOT NULL,
	`streamId` varchar(36) NOT NULL,
	`expiresAtMs` bigint NOT NULL,
	`consumedAtMs` bigint,
	CONSTRAINT `review_tiktok_link_codes_codeHash` PRIMARY KEY(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `review_tiktok_submission_links` (
	`submissionId` int NOT NULL,
	`streamId` varchar(36) NOT NULL,
	`platformUserId` varchar(128) NOT NULL,
	`actor` varchar(128) NOT NULL,
	`linkedAtMs` bigint NOT NULL,
	CONSTRAINT `review_tiktok_submission_links_submissionId` PRIMARY KEY(`submissionId`)
);
--> statement-breakpoint
ALTER TABLE `review_occurrences` ADD `completionReason` varchar(16);