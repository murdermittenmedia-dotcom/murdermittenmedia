-- Migration: live_sessions + stream_summaries + notifications metadata column

-- Live Sessions
CREATE TABLE IF NOT EXISTS `live_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creatorId` int NOT NULL,
  `streamTitle` varchar(256) DEFAULT 'Live Stream',
  `youtubeUrl` varchar(512),
  `isActive` boolean NOT NULL DEFAULT true,
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` timestamp,
  `peakViewers` int NOT NULL DEFAULT 0,
  `totalViewerMinutes` int NOT NULL DEFAULT 0,
  `viewerSnapshots` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Stream Summaries
CREATE TABLE IF NOT EXISTS `stream_summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creatorId` int NOT NULL,
  `sessionId` int,
  `streamTitle` varchar(256) DEFAULT 'Live Stream',
  `startedAt` timestamp NOT NULL,
  `endedAt` timestamp NOT NULL,
  `durationSeconds` int NOT NULL DEFAULT 0,
  `totalViews` int NOT NULL DEFAULT 0,
  `peakViewers` int NOT NULL DEFAULT 0,
  `avgViewers` int NOT NULL DEFAULT 0,
  `totalGifts` int NOT NULL DEFAULT 0,
  `totalCoinsGifted` int NOT NULL DEFAULT 0,
  `totalLiveRewards` int NOT NULL DEFAULT 0,
  `totalFireVotes` int NOT NULL DEFAULT 0,
  `totalLikes` int NOT NULL DEFAULT 0,
  `newFollowers` int NOT NULL DEFAULT 0,
  `topGifters` text,
  `giftBreakdown` text,
  `likeBreakdown` text,
  `engagementSummary` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Add metadata column to notifications (if not exists)
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `metadata` text;
