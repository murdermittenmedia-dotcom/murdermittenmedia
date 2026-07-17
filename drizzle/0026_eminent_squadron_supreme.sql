CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`color` varchar(64) NOT NULL,
	`size` varchar(16) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merch_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`imageUrl` varchar(512) NOT NULL,
	`frontImageUrl` varchar(512),
	`backImageUrl` varchar(512),
	`colors` text NOT NULL,
	`sizes` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`isLimitedRelease` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merch_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCheckoutSessionId` varchar(256),
	`stripePaymentIntentId` varchar(256),
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`subtotalCents` int NOT NULL,
	`shippingCents` int NOT NULL,
	`taxCents` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`shippingAddress` text,
	`items` text NOT NULL,
	`confirmationEmailSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
