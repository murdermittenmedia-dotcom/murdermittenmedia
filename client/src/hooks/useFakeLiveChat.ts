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

// Massive pool of comment variants with randomized case and emojis
const COMMENT_VARIANTS = [
  // Fire/Hype reactions
  "🔥🔥🔥", "FIRE", "fire", "FiRe", "THIS HARD", "this hard", "THIS HARD!!!",
  "GO OFF", "go off", "GoOoFf", "BARS", "bars", "BaRs", "HEAT", "heat", "HEaT",
  "🔥 FIRE 🔥", "🔥🔥🔥🔥", "FLAMES", "flames", "FLaMeS", "CRAZY", "crazy", "CrAzY",
  "INSANE", "insane", "InSaNe", "HARD", "hard", "HaRd", "SLAPS", "slaps", "SlApS",
  "BANGER", "banger", "BaNgEr", "GOES HARD", "goes hard", "GoEs HaRd", "🔥 THIS", "🔥 THAT",
  "FIRE TRACK", "fire track", "FiRe TrAcK", "ABSOLUTE HEAT", "absolute heat",
  "CERTIFIED BANGER", "certified banger", "PRODUCTION CRAZY", "production crazy",
  
  // Trash reactions
  "🗑️", "TRASH", "trash", "TrAsH", "WEAK", "weak", "WeAk", "MID", "mid", "MiD",
  "SKIP", "skip", "SkIp", "NEXT", "next", "NeXt", "NAH", "nah", "NaH", "NOPE", "nope",
  "🗑️🗑️🗑️", "GARBAGE", "garbage", "GaRbAgE", "CORNY", "corny", "CoRnY", "LAME", "lame", "LaMe",
  "BORING", "boring", "BoRiNg", "YAWN", "yawn", "YaWn", "DELETE", "delete", "DeLeTE",
  "NOT IT", "not it", "NoT iT", "PASS", "pass", "PaSs", "HARD PASS", "hard pass",
  
  // Knife reactions
  "🔪", "🔪🔪🔪", "CUT IT", "cut it", "CuT iT", "SLICE", "slice", "SlIcE",
  "SLICING", "slicing", "CHOPPED", "chopped",
  
  // Mixed reactions
  "🔥🗑️", "🔥🔪", "🗑️🔪", "🔥🗑️🔪", "FIRE OR TRASH", "fire or trash",
  
  // Generic hype
  "YESSIR", "yessir", "YeSSiR", "LETS GO", "lets go", "LeTs Go", "TURN UP", "turn up", "TuRn Up",
  "VIBE", "vibe", "ViBeS", "SMOOTH", "smooth", "SmOoTh", "CLEAN", "clean", "ClEaN",
  "NICE", "nice", "NiCe", "GOOD", "good", "GoOd", "DOPE", "dope", "DoOpE", "DOPEEEE",
  "SICK", "sick", "SiCk", "TIGHT", "tight", "TiGhT", "FRESH", "fresh", "FrEsH",
  
  // Artist/Song specific
  "WHO IS THIS", "who is this", "WhO iS tHiS", "ARTIST?", "artist?", "ArTiSt?",
  "TRACK ID", "track id", "TrAcK iD", "SONG NAME", "song name", "SoNg NaMe",
  "DROP IT", "drop it", "DrOp It", "RELEASE THIS", "release this", "ReLeSe ThIs",
  "NEED THIS", "need this", "NeeD tHiS", "SEND LINK", "send link", "SeNd LiNk",
  
  // Vibe checks
  "VIBE CHECK", "vibe check", "ViBeChEcK", "ENERGY", "energy", "EnErGy",
  "FEEL THAT", "feel that", "FeEl ThAt", "HITTING", "hitting", "HiTTiNg",
  "BUMPING", "bumping", "BuMpInG", "NODDING", "nodding", "NoD nOd", "HEAD NODDING",
  "VIBING", "vibing", "ViBeInG", "LOCKED IN", "locked in", "LoCkEd In",
  
  // Crowd reactions
  "🙌", "🙌🙌", "🙌🙌🙌", "LETS GOOOO", "lets goooo", "LeTs GoOoOo",
  "AYEEE", "ayeee", "AyEeE", "YOOOOO", "yooooo", "YoOoOo", "WOAH", "woah", "WoAh",
  "YESSSS", "yessss", "YeEeSsS", "LETS GOOOOOO", "AYOOOO", "ayoooo",
  
  // Emoji spam
  "🔥🔥🔥🔥🔥", "🗑️🗑️🗑️🗑️🗑️", "🔪🔪🔪🔪🔪",
  "🎵🎵🎵", "🎶🎶🎶", "🎤🎤🎤", "🎧🎧🎧",
  "🔥🎵🔥", "🎤🔥🎤", "🎧🔥🎧",
  
  // Short reactions
  "YES", "yes", "YeS", "NO", "no", "NoO", "OK", "ok", "Ok",
  "WOW", "wow", "WoW", "OMG", "omg", "OmG", "LOL", "lol", "LoL",
  "BRO", "bro", "BrO", "FAM", "fam", "FaM", "FACTS", "facts", "FaCtS",
  "REAL", "real", "ReAl", "PERIOD", "period", "PeRiOd",
  
  // Specific vibes
  "PRODUCTION CLEAN", "production clean", "MIXING CRAZY", "mixing crazy",
  "FLOW NASTY", "flow nasty", "BARS CRAZY", "bars crazy",
  "BEAT SELECTION", "beat selection", "BEAT INSANE", "beat insane",
  "SAMPLE CRAZY", "sample crazy", "SAMPLE CHOICE", "sample choice",
  "HOOK CRAZY", "hook crazy", "HOOK STICKY", "hook sticky",
  "VERSE HARD", "verse hard", "VERSE CRAZY", "verse crazy",
  "FEATURE CRAZY", "feature crazy", "COLLAB FIRE", "collab fire",
];

export type ReactionType = "hype" | "trash" | "knife" | "bars" | "weak" | "next";

const REACTION_MAP: Record<ReactionType, string[]> = {
  hype: ["🔥", "FIRE", "fire", "FiRe", "THIS HARD", "GO OFF", "BARS", "HEAT", "🔥🔥🔥", "SLAPS", "BANGER", "GOES HARD", "FLAMES", "CRAZY", "INSANE", "HARD", "ABSOLUTE HEAT", "CERTIFIED BANGER"],
  trash: ["🗑️", "TRASH", "trash", "WEAK", "MID", "SKIP", "NEXT", "🗑️🗑️🗑️", "GARBAGE", "CORNY", "LAME", "BORING", "NOT IT", "PASS", "HARD PASS"],
  knife: ["🔪", "🔪🔪🔪", "CUT IT", "SLICE", "SLICING", "CHOPPED"],
  bars: ["🔥", "BARS", "FIRE", "THIS HARD", "SLAPS", "🔥🔥🔥", "BANGER", "FLOW NASTY", "BARS CRAZY", "VERSE HARD"],
  weak: ["🗑️", "WEAK", "TRASH", "MID", "GARBAGE", "LAME", "NOT IT"],
  next: ["NEXT", "SKIP", "LETS GO", "DROP IT", "NEED THIS", "SEND LINK"],
};

/**
 * Hook that generates fake viewer count (50-250) and random chat messages
 * from real signed-up users with actual usernames (not auto-generated IDs)
 */
export function useFakeLiveChat() {
  const [viewerCount, setViewerCount] = useState(50);
  const [fakeMessages, setFakeMessages] = useState<FakeChatMessage[]>([]);
  const [triggeredReaction, setTriggeredReaction] = useState<ReactionType | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  
  // Fetch all users for generating fake messages
  const { data: allUsers } = trpc.admin.listUsers.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 1000 * 60 * 5, retry: false }
  );

  // Select users with real usernames/artist names (filter out auto-generated User IDs)
  useEffect(() => {
    if (!allUsers || allUsers.length === 0) return;
    
    // Filter for users with actual names set (not just auto-generated User123456)
    const usersWithRealNames = allUsers.filter(u => {
      const hasArtistName = u.artistName && u.artistName.trim() && !u.artistName.match(/^User\d+$/);
      const hasUsername = u.username && u.username.trim() && !u.username.match(/^User\d+$/);
      return hasArtistName || hasUsername;
    });

    // If we have enough real users, use them; otherwise use all users
    const usersToUse = usersWithRealNames.length > 3 ? usersWithRealNames : allUsers;
    
    // Pick 5-10 random users and shuffle them
    const shuffled = [...usersToUse].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, usersToUse.length));
    setSelectedUsers(selected);
  }, [allUsers]);

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
    if (selectedUsers.length === 0) return;

    const interval = setInterval(() => {
      const randomUser = selectedUsers[Math.floor(Math.random() * selectedUsers.length)];
      
      // Use triggered reaction pool or random comments
      let commentPool = COMMENT_VARIANTS;
      if (triggeredReaction) {
        commentPool = REACTION_MAP[triggeredReaction];
      }
      
      const randomComment = commentPool[Math.floor(Math.random() * commentPool.length)];
      
      const newMessage: FakeChatMessage = {
        id: `fake-${Date.now()}-${Math.random()}`,
        username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
        text: randomComment,
        timestamp: Date.now(),
        role: randomUser.role === "admin" ? "admin" : randomUser.role === "judge" ? "judge" : "user",
        userId: randomUser.id,
      };

      setFakeMessages(prev => {
        // Keep only last 30 messages
        const updated = [...prev, newMessage];
        return updated.slice(-30);
      });
    }, triggeredReaction ? 300 : 4000 + Math.random() * 8000); // Faster during triggered reactions

    return () => clearInterval(interval);
  }, [selectedUsers, triggeredReaction]);

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
