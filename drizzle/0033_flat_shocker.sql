CREATE TABLE `link_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`type` enum('social','release','custom','header') NOT NULL DEFAULT 'custom',
	`title` varchar(128) NOT NULL,
	`url` varchar(512),
	`subtitle` varchar(255),
	`platform` varchar(64),
	`icon` varchar(64),
	`thumbnailUrl` varchar(512),
	`songId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `link_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `link_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`displayName` varchar(128),
	`bio` text,
	`avatarUrl` varchar(512),
	`theme` varchar(32) NOT NULL DEFAULT 'midnight',
	`backgroundColor` varchar(32) NOT NULL DEFAULT '#080808',
	`accentColor` varchar(32) NOT NULL DEFAULT '#d10000',
	`buttonStyle` enum('solid','outline','soft','glass') NOT NULL DEFAULT 'solid',
	`isPublished` boolean NOT NULL DEFAULT false,
	`showBranding` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `link_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_pages_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `link_pages_slug_unique` UNIQUE(`slug`)
);
