ALTER TABLE `beat_sales` ADD `stripeBalanceTransactionId` varchar(256);--> statement-breakpoint
ALTER TABLE `beat_sales` ADD `producerEarningsStatus` enum('pending','available','reversed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `beat_sales` ADD `producerEarningsAvailableAt` timestamp;--> statement-breakpoint
ALTER TABLE `beat_sales` ADD `producerEarningsSettledAt` timestamp;