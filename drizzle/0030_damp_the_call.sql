CREATE TABLE `studio_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`userId` int,
	`guestName` varchar(128),
	`guestEmail` varchar(320),
	`rating` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`reviewText` text NOT NULL,
	`isVerified` boolean NOT NULL DEFAULT false,
	`isApproved` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studio_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioName` varchar(256) NOT NULL,
	`location` varchar(512) NOT NULL,
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`engineers` text,
	`contactInfo` varchar(512) NOT NULL,
	`instagramHandle` varchar(128),
	`twitterHandle` varchar(128),
	`facebookUrl` varchar(512),
	`websiteUrl` varchar(512),
	`youtubeChannel` varchar(512),
	`tiktokHandle` varchar(128),
	`description` text,
	`imageUrl` varchar(512),
	`averageRating` varchar(10) DEFAULT '0',
	`reviewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studios_id` PRIMARY KEY(`id`)
);
