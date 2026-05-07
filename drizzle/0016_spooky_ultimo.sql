CREATE TABLE `moderation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`adminName` varchar(128) NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(64) NOT NULL,
	`targetId` int NOT NULL,
	`targetPreview` varchar(512),
	`reason` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_logs_id` PRIMARY KEY(`id`)
);
