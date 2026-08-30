ALTER TABLE `review_plus_memberships` ADD `chatAccent` enum('gold','crimson','violet') DEFAULT 'gold' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_plus_memberships` ADD `chatIcon` enum('crown','fire','star') DEFAULT 'crown' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_plus_memberships` ADD `chatStyle` enum('banner','outline') DEFAULT 'banner' NOT NULL;