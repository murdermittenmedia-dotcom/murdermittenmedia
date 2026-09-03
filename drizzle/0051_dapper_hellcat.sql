ALTER TABLE `queue_state` ADD `livePlaybackState` varchar(16) DEFAULT 'stopped' NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `livePlaybackStartedAt` bigint;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `livePlaybackPositionMs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_state` ADD `livePlaybackRevision` int DEFAULT 0 NOT NULL;