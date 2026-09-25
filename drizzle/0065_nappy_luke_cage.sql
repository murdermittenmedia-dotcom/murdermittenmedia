CREATE TABLE `beat_wallet_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`producerId` int NOT NULL,
	`amountCents` int NOT NULL,
	`reason` varchar(512) NOT NULL,
	`adminId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `beat_wallet_adjustments_id` PRIMARY KEY(`id`)
);
