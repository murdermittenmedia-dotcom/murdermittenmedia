-- Migration: Virtual Economy System
-- Adds: Live Rewards, Fire Vote balances, conversions, wallet transactions,
--        economy config, coin packages, creator cashouts, fraud logs
-- Also alters: gift_types (adds rarity, animationType, description, etc.)

-- ── 1. Alter gift_types to add new columns ────────────────────
ALTER TABLE `gift_types`
  ADD COLUMN `description` varchar(256),
  ADD COLUMN `rarity` enum('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'common',
  ADD COLUMN `animationType` varchar(64) NOT NULL DEFAULT 'float',
  ADD COLUMN `soundEffect` varchar(64),
  ADD COLUMN `isLimitedTime` boolean NOT NULL DEFAULT false,
  ADD COLUMN `expiresAt` timestamp;

-- ── 2. Live Rewards wallet ────────────────────────────────────
CREATE TABLE `live_rewards` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `available` int NOT NULL DEFAULT 0,
  `pending` int NOT NULL DEFAULT 0,
  `lifetimeEarned` int NOT NULL DEFAULT 0,
  `lifetimeWithdrawn` int NOT NULL DEFAULT 0,
  `isFrozen` boolean NOT NULL DEFAULT false,
  `frozenReason` varchar(256),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `live_rewards_userId_unique` (`userId`)
);

-- ── 3. Fire Vote balances ─────────────────────────────────────
CREATE TABLE `fire_vote_balances` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `balance` int NOT NULL DEFAULT 0,
  `lifetimeEarned` int NOT NULL DEFAULT 0,
  `lifetimeConverted` int NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `fire_vote_balances_userId_unique` (`userId`)
);

-- ── 4. Fire Vote → Coin conversions ──────────────────────────
CREATE TABLE `fire_vote_conversions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `fireVotesBurned` int NOT NULL,
  `coinsAwarded` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. Wallet transactions ledger ────────────────────────────
CREATE TABLE `wallet_transactions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `currency` enum('coins','fire_votes','live_rewards') NOT NULL,
  `type` varchar(64) NOT NULL,
  `amount` int NOT NULL,
  `balanceAfter` int NOT NULL,
  `referenceId` int,
  `referenceType` varchar(64),
  `note` varchar(256),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. Economy config (single row) ───────────────────────────
CREATE TABLE `economy_config` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `creatorSplitPct` int NOT NULL DEFAULT 70,
  `platformSplitPct` int NOT NULL DEFAULT 30,
  `fireVoteConversionEnabled` boolean NOT NULL DEFAULT true,
  `fireVotesPerConversion` int NOT NULL DEFAULT 50,
  `coinsPerConversion` int NOT NULL DEFAULT 10,
  `fvDailyCoinCap` int NOT NULL DEFAULT 100,
  `fvWeeklyCoinCap` int NOT NULL DEFAULT 500,
  `fvMonthlyCoinCap` int NOT NULL DEFAULT 2000,
  `minCashoutCents` int NOT NULL DEFAULT 500,
  `cashAppEnabled` boolean NOT NULL DEFAULT true,
  `paypalEnabled` boolean NOT NULL DEFAULT true,
  `applePayEnabled` boolean NOT NULL DEFAULT true,
  `fraudAutoFreezeEnabled` boolean NOT NULL DEFAULT true,
  `fraudRapidGiftThreshold` int NOT NULL DEFAULT 10,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` int
);

-- Seed the default config row
INSERT INTO `economy_config` (`creatorSplitPct`, `platformSplitPct`) VALUES (70, 30);

-- ── 7. Coin packages ─────────────────────────────────────────
CREATE TABLE `coin_packages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(64) NOT NULL,
  `coins` int NOT NULL,
  `bonusCoins` int NOT NULL DEFAULT 0,
  `priceCents` int NOT NULL,
  `badge` varchar(32),
  `isActive` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed launch packages
INSERT INTO `coin_packages` (`name`, `coins`, `bonusCoins`, `priceCents`, `badge`, `sortOrder`) VALUES
  ('Starter', 100, 0, 99, NULL, 1),
  ('Supporter', 600, 50, 499, NULL, 2),
  ('Fan Pack', 1400, 150, 999, 'most_popular', 3),
  ('Hype Pack', 3900, 500, 2499, NULL, 4),
  ('Mitten Elite', 8500, 1200, 4999, 'best_value', 5),
  ('Hall of Fame', 18000, 3000, 9999, NULL, 6);

-- ── 8. Creator cashout requests ──────────────────────────────
CREATE TABLE `creator_cashouts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `amountCents` int NOT NULL,
  `paymentMethod` enum('cashapp','paypal','applepay') NOT NULL,
  `paymentHandle` varchar(128) NOT NULL,
  `status` enum('pending','approved','paid','on_hold','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `adminNote` varchar(512),
  `processedAt` timestamp,
  `processedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── 9. Fraud logs ─────────────────────────────────────────────
CREATE TABLE `fraud_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `type` varchar(64) NOT NULL,
  `riskScore` enum('low','medium','high','critical') NOT NULL,
  `details` text,
  `ipAddress` varchar(64),
  `deviceFingerprint` varchar(128),
  `resolved` boolean NOT NULL DEFAULT false,
  `resolvedBy` int,
  `resolvedAt` timestamp,
  `resolvedNote` varchar(512),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 10. Seed 20 custom Murder Mitten gifts ────────────────────
-- Clear any existing default gifts first
DELETE FROM `gift_types` WHERE id > 0;

INSERT INTO `gift_types` (`name`, `emoji`, `description`, `coinCost`, `usdValueCents`, `rarity`, `animationType`, `sortOrder`) VALUES
  ('Murder Mitten', '🧤', 'The signature Murder Mitten — show your Detroit love', 10, 7, 'common', 'float', 1),
  ('Fire', '🔥', 'This track is straight fire', 25, 18, 'common', 'float', 2),
  ('Respect', '✊', 'Show mad respect to the artist', 50, 35, 'common', 'float', 3),
  ('One Mic', '🎤', 'One mic, one chance — this artist has it', 100, 70, 'uncommon', 'burst', 4),
  ('Camera Flash', '📸', 'Capture the moment — this is viral', 150, 105, 'uncommon', 'burst', 5),
  ('Money Stack', '💵', 'Stack on stack — show the money', 200, 140, 'uncommon', 'burst', 6),
  ('Money Bag', '💰', 'Big bag energy', 300, 210, 'rare', 'burst', 7),
  ('Trophy', '🏆', 'Award-winning performance', 500, 350, 'rare', 'explosion', 8),
  ('Platinum Record', '💿', 'Going platinum in the Mitten', 750, 525, 'rare', 'explosion', 9),
  ('Crown', '👑', 'You are the king of this stream', 1000, 700, 'epic', 'explosion', 10),
  ('Diamond Chain', '💎', 'Dripping in diamonds — elite level', 1500, 1050, 'epic', 'explosion', 11),
  ('Muscle Car', '🚗', 'Detroit muscle — rev it up', 2000, 1400, 'epic', 'legendary', 12),
  ('Street Racer', '🏎️', 'Fastest in the Mitten', 2500, 1750, 'epic', 'legendary', 13),
  ('Viral Video', '📱', 'This is going viral — guaranteed', 3000, 2100, 'legendary', 'legendary', 14),
  ('Rocket', '🚀', 'Launching to the top', 3500, 2450, 'legendary', 'legendary', 15),
  ('News Chopper', '🚁', 'Breaking news — this artist is taking off', 5000, 3500, 'legendary', 'legendary', 16),
  ('313 Skyline', '🌆', 'Detroit skyline — represent the city', 7500, 5250, 'legendary', 'mythic', 17),
  ('Murder Mitten Studios', '🎬', 'Full studio treatment — you deserve it', 10000, 7000, 'mythic', 'mythic', 18),
  ('Diamond Mitten', '💎🧤', 'The rarest gift — a diamond-encrusted Murder Mitten', 15000, 10500, 'mythic', 'mythic', 19),
  ('Fire Storm', '🌪️🔥', 'Legendary fire storm — the ultimate tribute', 25000, 17500, 'mythic', 'mythic', 20);
