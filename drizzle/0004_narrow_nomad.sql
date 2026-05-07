CREATE TABLE `battle_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundNumber` int NOT NULL DEFAULT 1,
	`winnerId` int,
	`winnerArtistName` varchar(128) NOT NULL,
	`winnerSongTitle` varchar(128) NOT NULL,
	`winnerSongUrl` varchar(512),
	`loserId` int,
	`loserArtistName` varchar(128) NOT NULL,
	`loserSongTitle` varchar(128) NOT NULL,
	`loserSongUrl` varchar(512),
	`notes` text,
	`battleDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `battle_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_songs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(128) NOT NULL,
	`artistName` varchar(128) NOT NULL,
	`fileKey` varchar(512),
	`fileUrl` varchar(512),
	`externalUrl` varchar(512),
	`genre` varchar(64),
	`duration` int,
	`isPublic` boolean NOT NULL DEFAULT true,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_songs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `artistName` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `instagramHandle` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `profileComplete` boolean DEFAULT false NOT NULL;