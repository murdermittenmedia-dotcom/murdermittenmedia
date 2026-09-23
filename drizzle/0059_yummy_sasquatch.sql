ALTER TABLE `beat_direct_payments` MODIFY COLUMN `provider` enum('cashapp','paypal','zelle','venmo','apple_pay','chime','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `beat_producer_direct_payment_methods` MODIFY COLUMN `provider` enum('cashapp','paypal','zelle','venmo','apple_pay','chime','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `beat_direct_payments` ADD `confirmationMode` enum('producer','admin') DEFAULT 'producer' NOT NULL;--> statement-breakpoint
ALTER TABLE `beat_direct_payments` ADD `confirmedBy` int;--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` ADD `adminGranted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` ADD `adminGrantedAt` timestamp;--> statement-breakpoint
ALTER TABLE `beat_producer_memberships` ADD `adminGrantedBy` int;