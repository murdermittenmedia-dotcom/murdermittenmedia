ALTER TABLE `beat_sales` MODIFY COLUMN `beatTitleSnapshot` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_beats` MODIFY COLUMN `title` varchar(512) NOT NULL;