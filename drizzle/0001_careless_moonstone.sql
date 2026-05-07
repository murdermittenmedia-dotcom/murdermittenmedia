CREATE TABLE `artist_of_week` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistName` varchar(128) NOT NULL,
	`bio` text,
	`imageUrl` varchar(512),
	`instagramUrl` varchar(512),
	`youtubeUrl` varchar(512),
	`spotifyUrl` varchar(512),
	`featuredVideoId` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`weekOf` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artist_of_week_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queue_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currentPlayingId` int,
	`isLive` boolean NOT NULL DEFAULT false,
	`liveMessage` varchar(256),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queue_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistName` varchar(128) NOT NULL,
	`songTitle` varchar(128) NOT NULL,
	`submissionType` enum('youtube','file') NOT NULL,
	`youtubeUrl` varchar(512),
	`fileKey` varchar(512),
	`fileUrl` varchar(512),
	`contactInfo` varchar(256),
	`status` enum('pending','playing','reviewed','removed') NOT NULL DEFAULT 'pending',
	`skippedLine` boolean NOT NULL DEFAULT false,
	`skipPaymentConfirmed` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_submissions_id` PRIMARY KEY(`id`)
);
