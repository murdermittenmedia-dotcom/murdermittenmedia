CREATE TABLE `promo_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`type` varchar(50) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`expirationDate` timestamp,
	`minimumSubtotal` int,
	`maximumUses` int NOT NULL DEFAULT 999,
	`usageCount` int NOT NULL DEFAULT 0,
	`firstTimeOnly` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_codes_code_unique` UNIQUE(`code`)
);
