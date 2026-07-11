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

/**
 * Hook that generates fake viewer count (50-250) and random chat messages
 * from real signed-up users on the website
 */
export function useFakeLiveChat() {
  const [viewerCount, setViewerCount] = useState(50);
  const [fakeMessages, setFakeMessages] = useState<FakeChatMessage[]>([]);
  
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

  // Generate fake chat messages every 4-12 seconds
  useEffect(() => {
    if (!allUsers || allUsers.length === 0) return;

    const interval = setInterval(() => {
      const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
      const randomReaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      
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
    }, 4000 + Math.random() * 8000);

    return () => clearInterval(interval);
  }, [allUsers]);

  return {
    viewerCount,
    fakeMessages,
  };
}
