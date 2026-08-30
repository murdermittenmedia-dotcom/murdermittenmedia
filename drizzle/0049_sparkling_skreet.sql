CREATE TABLE `shop_product_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`orderId` int,
	`rating` int NOT NULL,
	`title` varchar(160),
	`body` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`verifiedPurchase` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_product_reviews_id` PRIMARY KEY(`id`)
);
