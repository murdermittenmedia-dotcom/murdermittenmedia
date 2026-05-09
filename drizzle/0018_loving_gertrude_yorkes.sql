ALTER TABLE `votes` MODIFY COLUMN `candidate` enum('contestant1','contestant2','contestant3') NOT NULL;--> statement-breakpoint
ALTER TABLE `active_battle` ADD `contestant3Name` varchar(128);--> statement-breakpoint
ALTER TABLE `active_battle` ADD `contestant3SongTitle` varchar(128);--> statement-breakpoint
ALTER TABLE `active_battle` ADD `contestant3SongUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `active_battle` ADD `isTripleThreat` boolean DEFAULT false NOT NULL;