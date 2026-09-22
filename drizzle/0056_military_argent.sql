ALTER TABLE `marketplace_beats` ADD `previewTagSource` enum('none','purchase_now','purchase_today','mitten','custom') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_beats` ADD `previewTagFileKey` varchar(512);--> statement-breakpoint
ALTER TABLE `marketplace_beats` ADD `previewTagFileUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `marketplace_beats` ADD `previewTagAtSeconds` int DEFAULT 0 NOT NULL;