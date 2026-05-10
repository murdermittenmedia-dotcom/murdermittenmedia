CREATE TABLE `wheel_of_names_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`isPaid` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wheel_of_names_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wheel_of_names_paid_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quantity` int NOT NULL,
	`amountPaid` int NOT NULL,
	`adminConfirmed` boolean NOT NULL DEFAULT false,
	`confirmedAt` timestamp,
	`confirmedByAdminId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wheel_of_names_paid_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wheel_of_names_spins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spinDate` varchar(10) NOT NULL,
	`winnerId` int,
	`winnerName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wheel_of_names_spins_id` PRIMARY KEY(`id`),
	CONSTRAINT `wheel_of_names_spins_spinDate_unique` UNIQUE(`spinDate`)
);
