CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`username` varchar(64) NOT NULL,
	`message` varchar(500) NOT NULL,
	`room` enum('music_wars','music_review') NOT NULL,
	`isAdmin` boolean NOT NULL DEFAULT false,
	`deleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `wheel_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`artistName` varchar(128) NOT NULL,
	`songTitle` varchar(128) NOT NULL,
	`songUrl` varchar(512),
	`contactInfo` varchar(256),
	`paid` boolean NOT NULL DEFAULT false,
	`paymentConfirmed` boolean NOT NULL DEFAULT false,
	`status` enum('pending','active','eliminated','winner','removed') NOT NULL DEFAULT 'pending',
	`wheelPosition` int NOT NULL DEFAULT 0,
	`roundNumber` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wheel_entries_id` PRIMARY KEY(`id`)
);
