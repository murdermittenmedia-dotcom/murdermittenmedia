CREATE TABLE `activity_feed` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL,
	`message` varchar(512) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_feed_id` PRIMARY KEY(`id`)
);
