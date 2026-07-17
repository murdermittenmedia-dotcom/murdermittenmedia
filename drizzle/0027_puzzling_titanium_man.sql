CREATE TABLE `shop_product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(512) NOT NULL,
	`storageKey` varchar(512),
	`imageType` enum('thumbnail','front','back','size_chart','gallery') NOT NULL DEFAULT 'gallery',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`subtitle` varchar(256),
	`slug` varchar(256) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`compareAtPrice` int,
	`category` varchar(128),
	`status` enum('draft','active','sold_out','hidden') NOT NULL DEFAULT 'draft',
	`featured` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`stripeProductId` varchar(256),
	`stripePriceId` varchar(256),
	`badge` varchar(128),
	`shippingEstimate` varchar(128),
	`seoTitle` varchar(256),
	`seoDescription` text,
	`salesCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `shop_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `shop_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`color` varchar(64) NOT NULL,
	`size` varchar(32) NOT NULL,
	`inventoryQty` int NOT NULL DEFAULT 0,
	`sku` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_variants_id` PRIMARY KEY(`id`)
);
