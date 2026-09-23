CREATE TABLE `beat_direct_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`producerId` int NOT NULL,
	`buyerId` int NOT NULL,
	`provider` enum('cashapp','zelle','venmo','apple_pay','chime') NOT NULL,
	`destinationSnapshot` varchar(512) NOT NULL,
	`instructionsSnapshot` varchar(512),
	`paymentReference` varchar(256),
	`status` enum('awaiting_payment','submitted','confirmed','declined','cancelled') NOT NULL DEFAULT 'awaiting_payment',
	`producerNote` varchar(512),
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_direct_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_direct_payments_saleId_unique` UNIQUE(`saleId`)
);
--> statement-breakpoint
CREATE TABLE `beat_producer_direct_payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`producerId` int NOT NULL,
	`provider` enum('cashapp','zelle','venmo','apple_pay','chime') NOT NULL,
	`destination` varchar(512) NOT NULL,
	`instructions` varchar(512),
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `beat_producer_direct_payment_methods_id` PRIMARY KEY(`id`),
	CONSTRAINT `beat_producer_direct_payment_provider_unique` UNIQUE(`producerId`,`provider`)
);
