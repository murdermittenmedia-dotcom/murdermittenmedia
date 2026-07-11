import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface FakeChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  role: "user" | "admin" | "judge";
  userId: number;
}

const REACTIONS = ["🔥", "🗑️", "🔪", "THIS HARD", "SKIP", "FIRE", "TRASH", "BARS", "WEAK", "NEXT", "GO OFF", "MID", "HEAT"];

export type ReactionType = "hype" | "trash" | "knife" | "bars" | "weak" | "next";

const REACTION_MAP: Record<ReactionType, string[]> = {
  hype: ["🔥", "FIRE", "THIS HARD", "GO OFF"],
  trash: ["🗑️", "TRASH", "WEAK", "MID"],
  knife: ["🔪", "KNIFE"],
  bars: ["🔥", "BARS", "THIS HARD"],
  weak: ["🗑️", "WEAK", "MID"],
  next: ["NEXT", "SKIP"],
};

/**
 * Hook that generates fake viewer count (50-250) and random chat messages
 * from real signed-up users on the website
 */
export function useFakeLiveChat() {
  const [viewerCount, setViewerCount] = useState(50);
  const [fakeMessages, setFakeMessages] = useState<FakeChatMessage[]>([]);
  const [triggeredReaction, setTriggeredReaction] = useState<ReactionType | null>(null);
  
  // Fetch all users for generating fake messages
  const { data: allUsers } = trpc.admin.listUsers.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 1000 * 60 * 5, retry: false }
  );

  // Update viewer count every 3-8 seconds with random fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.floor(Math.random() * 40) - 20; // -20 to +20
        const newCount = Math.max(50, Math.min(250, prev + change));
        return newCount;
      });
    }, 3000 + Math.random() * 5000);

    return () => clearInterval(interval);
  }, []);

  // Generate fake chat messages every 4-12 seconds (or triggered reactions)
  useEffect(() => {
    if (!allUsers || allUsers.length === 0) return;

    const interval = setInterval(() => {
      const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
      
      // Use triggered reaction or random reaction
      let reactionPool = REACTIONS;
      if (triggeredReaction) {
        reactionPool = REACTION_MAP[triggeredReaction];
      }
      const randomReaction = reactionPool[Math.floor(Math.random() * reactionPool.length)];
      
      const newMessage: FakeChatMessage = {
        id: `fake-${Date.now()}-${Math.random()}`,
        username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
        text: randomReaction,
        timestamp: Date.now(),
        role: randomUser.role === "admin" ? "admin" : randomUser.role === "judge" ? "judge" : "user",
        userId: randomUser.id,
      };

      setFakeMessages(prev => {
        // Keep only last 20 messages
        const updated = [...prev, newMessage];
        return updated.slice(-20);
      });
    }, triggeredReaction ? 300 : 4000 + Math.random() * 8000); // Faster during triggered reactions

    return () => clearInterval(interval);
  }, [allUsers, triggeredReaction]);

  const triggerReaction = (reaction: ReactionType, duration: number = 3000) => {
    setTriggeredReaction(reaction);
    setTimeout(() => setTriggeredReaction(null), duration);
  };

  return {
    viewerCount,
    fakeMessages,
    triggerReaction,
    triggeredReaction,
  };
}
