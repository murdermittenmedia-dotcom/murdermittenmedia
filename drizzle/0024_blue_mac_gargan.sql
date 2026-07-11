ALTER TABLE `judge_streams` MODIFY COLUMN `ingressId` varchar(256);--> statement-breakpoint
ALTER TABLE `judge_streams` MODIFY COLUMN `rtmpUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `judge_streams` MODIFY COLUMN `rtmpKey` varchar(256);