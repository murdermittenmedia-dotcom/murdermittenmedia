CREATE TABLE `forum_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`parentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forum_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forum_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`body` text NOT NULL,
	`category` enum('general','music','battles','news','feedback') NOT NULL DEFAULT 'general',
	`pinned` boolean NOT NULL DEFAULT false,
	`locked` boolean NOT NULL DEFAULT false,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forum_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forum_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetType` enum('post','comment') NOT NULL,
	`targetId` int NOT NULL,
	`reaction` enum('upvote','downvote') NOT NULL DEFAULT 'upvote',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forum_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_radio_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`title` varchar(256) NOT NULL,
	`artistName` varchar(128) NOT NULL,
	`fileKey` varchar(512),
	`externalUrl` varchar(512),
	`sourceType` enum('upload','youtube','external') NOT NULL DEFAULT 'upload',
	`submissionId` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_radio_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_radio_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`isPaused` boolean NOT NULL DEFAULT false,
	`currentTrackId` int,
	`currentTrackStartedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_radio_state_id` PRIMARY KEY(`id`)
);
