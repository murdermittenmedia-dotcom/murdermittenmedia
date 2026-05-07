CREATE TABLE `active_battle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contestant1Name` varchar(128) NOT NULL,
	`contestant1SongTitle` varchar(128),
	`contestant1SongUrl` varchar(512),
	`contestant2Name` varchar(128) NOT NULL,
	`contestant2SongTitle` varchar(128),
	`contestant2SongUrl` varchar(512),
	`roundNumber` int NOT NULL DEFAULT 1,
	`status` enum('pending','voting','closed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `active_battle_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`battleId` int NOT NULL,
	`voterId` int NOT NULL,
	`voterRole` enum('user','judge','admin') NOT NULL DEFAULT 'user',
	`candidate` enum('contestant1','contestant2') NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`)
);
