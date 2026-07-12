ALTER TABLE `queue_state` ADD `playbackMode` enum('90sec','full','paid_only') DEFAULT '90sec' NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `submitPriceCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `skipPriceCents` int DEFAULT 1500 NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `fullSongPriceCents` int DEFAULT 500 NOT NULL;