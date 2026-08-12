CREATE TABLE `link_analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`itemId` int,
	`eventType` enum('view','click','presence') NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`deviceType` enum('desktop','mobile','tablet','unknown') NOT NULL DEFAULT 'unknown',
	`referrerHost` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_analytics_events_id` PRIMARY KEY(`id`)
);
