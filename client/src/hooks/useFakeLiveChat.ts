import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export interface FakeChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  role: "user" | "admin" | "judge";
  userId: number;
}

// Balanced mix of uppercase, lowercase, and natural case comments
const COMMENT_VARIANTS = [
  // Natural/lowercase (most common in real chats)
  "this hard", "fire", "bars", "heat", "slaps", "goes hard", "banger",
  "this go crazy", "i fw this", "lowkey fire", "this different", "ok ok ok",
  "not bad", "this clean", "vibing", "feel that", "locked in", "bumping",
  "this hitting", "smooth", "dope", "sick", "tight", "fresh", "nice",
  "who is this", "track id?", "drop it", "need this", "send link",
  "this hard fr", "no cap this fire", "bro really went off", "ok i fw this",
  "this the one", "this it right here", "yeah yeah yeah", "ok i see you",
  "not skipping this one", "this a vibe", "head nodding rn",
  "this clean clean", "production crazy", "mixing on point",
  "flow nasty", "hook sticky", "verse hard", "beat insane",
  "sample choice crazy", "collab fire", "energy different",
  "this real music", "they not ready", "slept on fr",

  // Mixed case (natural typing)
  "Bars fr", "Fire track", "This hard", "Go off", "Heat 🔥", "Slaps hard",
  "Ok ok this hard", "Not bad at all", "This clean", "Feel that",
  "Locked in rn", "This hitting different", "Smooth af", "Dope track",
  "Sick beat", "Fresh sound", "Nice flow", "Who is this?", "Track ID?",
  "Drop it already", "Need this on Spotify", "Send the link",
  "This the one fr", "Yeah this hard", "Ok I fw this", "This a vibe fr",
  "Head nodding", "This clean clean", "Production crazy",
  "Flow nasty fr", "Hook too sticky", "Verse hard", "Beat insane",

  // Uppercase (less frequent, more hype moments)
  "FIRE", "BARS", "HEAT", "THIS HARD", "GO OFF", "SLAPS",
  "BANGER", "GOES HARD", "FLAMES", "CRAZY", "INSANE",
  "CERTIFIED BANGER", "ABSOLUTE HEAT", "PRODUCTION CRAZY",
  "FLOW NASTY", "HOOK STICKY", "VERSE HARD",

  // Trash reactions — natural
  "trash", "weak", "mid", "skip", "next", "nah", "nope",
  "not it", "pass", "hard pass", "garbage", "corny", "lame",
  "boring", "yawn", "delete this", "not feeling it",
  "this not it", "nah bro", "skip skip skip", "mid at best",
  "production weak", "flow off", "hook not catching",
  "beat selection off", "mixing bad", "this not ready",

  // Mixed trash
  "Trash", "Weak", "Mid", "Skip", "Nah", "Not it",
  "Pass on this one", "Not feeling it", "This not it",
  "Nah bro", "Mid at best", "Production weak",

  // Emoji only
  "🔥", "🔥🔥", "🔥🔥🔥", "🗑️", "🗑️🗑️", "🔪", "🔪🔪",
  "🎵", "🎶", "🎤", "🎧", "🙌", "🙌🙌",
  "🔥🎵", "🎤🔥", "🎧🔥", "🔥🗑️",
  "💯", "💯💯", "🤯", "😤", "🥶", "🫡", "🤌", "🤌🤌",
  "👏", "👏👏", "💀", "💀💀", "😭", "😭😭",
  "🎯", "⚡", "⚡⚡", "🔊", "🔊🔊",
  "🫶", "🫶🫶", "🙏", "🙏🙏",
  "😮", "😮😮", "🤩", "🤩🤩",
  "🔥💯", "💯🔥", "🎤💯", "🔥🎤🔥",
  "💀🔥", "🥶🔥", "🤯🔥", "😭🔥",

  // Short reactions
  "yes", "no", "ok", "wow", "omg", "lol", "bro", "fam",
  "facts", "real", "period", "Yes", "No", "Ok", "Wow",
  "Omg", "Lol", "Bro", "Fam", "Facts", "Real", "Period",
  "YES", "NO", "OK", "WOW", "OMG", "LOL", "BRO", "FAM",

  // Crowd reactions
  "lets go", "ayeee", "yooo", "woah", "yessss", "lets goooo",
  "Lets go", "Ayeee", "Yooo", "Woah", "Yessss",
  "LETS GO", "AYEEE", "YOOOOO", "WOAH", "YESSSS",
];

export type ReactionType = "hype" | "trash" | "knife" | "bars" | "weak" | "next";

const REACTION_MAP: Record<ReactionType, string[]> = {
  hype: ["🔥", "fire", "FIRE", "this hard", "THIS HARD", "go off", "GO OFF", "bars", "BARS", "heat", "HEAT", "🔥🔥🔥", "slaps", "banger", "BANGER", "flames", "crazy", "insane", "absolute heat"],
  trash: ["🗑️", "trash", "TRASH", "weak", "WEAK", "mid", "MID", "skip", "SKIP", "next", "NEXT", "🗑️🗑️🗑️", "garbage", "corny", "lame", "not it", "pass"],
  knife: ["🔪", "🔪🔪", "🔪🔪🔪", "🔪🔪🔪🔪", "🔪🔪🔪🔪🔪"],
  bars: ["🔥", "bars", "BARS", "fire", "FIRE", "this hard", "slaps", "🔥🔥🔥", "banger", "flow nasty", "bars crazy", "verse hard"],
  weak: ["🗑️", "weak", "WEAK", "trash", "TRASH", "mid", "MID", "garbage", "lame", "not it"],
  next: ["next", "NEXT", "skip", "SKIP", "lets go", "drop it", "need this", "send link"],
};

// Fake user accounts to mix in (User-style IDs for realism)
const FAKE_USER_ACCOUNTS = [
  { id: -1, username: "User19273930", artistName: null, role: "user" as const },
  { id: -2, username: "User84720193", artistName: null, role: "user" as const },
  { id: -3, username: "User30482910", artistName: null, role: "user" as const },
  { id: -4, username: "User57391820", artistName: null, role: "user" as const },
  { id: -5, username: "User62840193", artistName: null, role: "user" as const },
];

export function useFakeLiveChat() {
  const [viewerCount, setViewerCount] = useState(50);
  const [fakeMessages, setFakeMessages] = useState<FakeChatMessage[]>([]);
  const [triggeredReaction, setTriggeredReaction] = useState<ReactionType | null>(null);
  const [chatPool, setChatPool] = useState<any[]>([]);
  
  // Track last comment time per user (userId -> timestamp)
  const lastCommentTime = useRef<Record<string, number>>({});

  const { data: allUsers } = trpc.admin.listUsers.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 1000 * 60 * 5, retry: false }
  );

  // Build chat pool: real users with names + some User-style accounts
  useEffect(() => {
    const realNameUsers = (allUsers ?? []).filter(u => {
      const name = u.artistName || u.username || "";
      // Only regular users — exclude admins and judges
      return name.trim().length > 0 && u.role === "user";
    });

    // Shuffle real users and pick up to 12
    const shuffledReal = [...realNameUsers].sort(() => Math.random() - 0.5).slice(0, 12);

    // Always include 3-5 fake User-style accounts
    const fakeCount = 3 + Math.floor(Math.random() * 3);
    const shuffledFake = [...FAKE_USER_ACCOUNTS].sort(() => Math.random() - 0.5).slice(0, fakeCount);

    setChatPool([...shuffledReal, ...shuffledFake]);
  }, [allUsers]);

  // Viewer count fluctuation
  useEffect(() => {
    const tick = () => {
      setViewerCount(prev => {
        const change = Math.floor(Math.random() * 40) - 20;
        return Math.max(50, Math.min(250, prev + change));
      });
    };
    const id = setInterval(tick, 3000 + Math.random() * 5000);
    return () => clearInterval(id);
  }, []);

  // Auto-chat messages with per-user cooldown
  useEffect(() => {
    if (chatPool.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // During triggered reaction, skip cooldown
      if (triggeredReaction) {
        const randomUser = chatPool[Math.floor(Math.random() * chatPool.length)];
        const pool = REACTION_MAP[triggeredReaction];
        const text = pool[Math.floor(Math.random() * pool.length)];
        const key = String(randomUser.id);
        lastCommentTime.current[key] = now;

        setFakeMessages(prev => [...prev, {
          id: `fake-${now}-${Math.random()}`,
          username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
          text,
          timestamp: now,
          role: randomUser.role === "admin" ? "admin" : randomUser.role === "judge" ? "judge" : "user",
          userId: randomUser.id,
        }].slice(-30));
        return;
      }

      // Normal mode: pick a user who hasn't commented in 2-3 minutes
      const cooldownMs = (120 + Math.random() * 60) * 1000; // 2-3 min
      const eligible = chatPool.filter(u => {
        const last = lastCommentTime.current[String(u.id)] ?? 0;
        return now - last >= cooldownMs;
      });

      // If no eligible users, skip this tick
      if (eligible.length === 0) return;

      const randomUser = eligible[Math.floor(Math.random() * eligible.length)];
      const text = COMMENT_VARIANTS[Math.floor(Math.random() * COMMENT_VARIANTS.length)];
      const key = String(randomUser.id);
      lastCommentTime.current[key] = now;

      setFakeMessages(prev => [...prev, {
        id: `fake-${now}-${Math.random()}`,
        username: randomUser.artistName || randomUser.username || `User${randomUser.id}`,
        text,
        timestamp: now,
        role: randomUser.role === "admin" ? "admin" : randomUser.role === "judge" ? "judge" : "user",
        userId: randomUser.id,
      }].slice(-30));

    }, triggeredReaction ? 300 : 4000 + Math.random() * 8000);

    return () => clearInterval(interval);
  }, [chatPool, triggeredReaction]);

  const triggerReaction = (reaction: ReactionType, duration = 3000) => {
    setTriggeredReaction(reaction);
    setTimeout(() => setTriggeredReaction(null), duration);
  };

  return { viewerCount, fakeMessages, triggerReaction, triggeredReaction };
}
