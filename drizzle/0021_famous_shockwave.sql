CREATE TABLE `active_sessions` (
	`sessionId` varchar(64) NOT NULL,
	`path` varchar(512) NOT NULL,
	`userId` int,
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `active_sessions_sessionId` PRIMARY KEY(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`path` varchar(512) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`referrer` varchar(512),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`)
);
