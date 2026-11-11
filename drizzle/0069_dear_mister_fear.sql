CREATE TABLE `article_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`userId` int NOT NULL,
	`body` varchar(2000) NOT NULL,
	`isHidden` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `article_comments_id` PRIMARY KEY(`id`)
);
