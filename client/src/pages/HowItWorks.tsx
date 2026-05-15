/* ============================================================
   HOW IT WORKS — XP & Tiers Explainer Page
   Public-facing breakdown of the XP system, tier levels,
   and how fans/artists earn and progress.
   ============================================================ */

import { SiteNav } from "@/components/SiteNav";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Zap, Trophy, Star, Heart, MessageSquare, Mic2, Swords,
  Music, Flame, TrendingUp, ChevronRight, Shield, Users
} from "lucide-react";

// ── Tier data (mirrors server/rewards.ts) ─────────────────────
const ARTIST_TIERS = [
  { level: "bronze",       minXP: 0,     label: "Bronze Artist",      color: "#CD7F32", icon: "🥉", perks: ["Access to Music Review submissions", "Forum posting", "Music Wars entry"] },
  { level: "verified",     minXP: 500,   label: "Verified Artist",    color: "#C0C0C0", icon: "✅", perks: ["Verified badge on profile", "Priority in search results", "All Bronze perks"] },
  { level: "trending",     minXP: 1500,  label: "Trending Artist",    color: "#FFD700", icon: "📈", perks: ["Trending badge", "Featured on leaderboard", "All Verified perks"] },
  { level: "city_motion",  minXP: 3000,  label: "City in Motion",     color: "#FF6B00", icon: "🏙️", perks: ["City in Motion badge", "Exclusive profile flair", "All Trending perks"] },
  { level: "mitten_elite", minXP: 6000,  label: "Mitten Elite",       color: "#D10000", icon: "🔥", perks: ["Elite red badge", "Top placement on leaderboard", "All City in Motion perks"] },
  { level: "hall_of_fame", minXP: 12000, label: "Hall of Fame",       color: "#9B59B6", icon: "🏆", perks: ["Hall of Fame badge", "Permanent recognition", "All Mitten Elite perks"] },
];

const FAN_TIERS = [
  { level: "supporter",           minXP: 0,    label: "Supporter",           color: "#6B7280", icon: "👋", perks: ["Vote on Music Wars battles", "Live chat access", "Daily Wheel spins"] },
  { level: "top_supporter",       minXP: 100,  label: "Top Supporter",       color: "#3B82F6", icon: "⭐", perks: ["Top Supporter badge", "Highlighted in leaderboard", "All Supporter perks"] },
  { level: "biggest_fan",         minXP: 300,  label: "Biggest Fan",         color: "#8B5CF6", icon: "💜", perks: ["Biggest Fan badge", "Special profile flair", "All Top Supporter perks"] },
  { level: "early_supporter",     minXP: 600,  label: "Early Supporter",     color: "#F59E0B", icon: "🌟", perks: ["Early Supporter badge", "Gold name highlight", "All Biggest Fan perks"] },
  { level: "verified_tastemaker", minXP: 1200, label: "Verified Tastemaker", color: "#10B981", icon: "🎯", perks: ["Tastemaker badge", "Top of fan leaderboard", "All Early Supporter perks"] },
];

// ── XP earning actions ────────────────────────────────────────
const ARTIST_XP_ACTIONS = [
  { icon: <Music className="w-5 h-5" />,   action: "Submit a song to Music Review",   xp: "+50 XP",  color: "text-red-400" },
  { icon: <Swords className="w-5 h-5" />,  action: "Win a Music Wars battle",          xp: "+150 XP", color: "text-yellow-400" },
  { icon: <Swords className="w-5 h-5" />,  action: "Participate in a Music Wars battle", xp: "+25 XP", color: "text-orange-400" },
  { icon: <Flame className="w-5 h-5" />,   action: "Receive a 🔥 Fire vote on your song", xp: "+10 XP", color: "text-orange-300" },
  { icon: <Mic2 className="w-5 h-5" />,    action: "Get your song played on live radio", xp: "+20 XP", color: "text-red-300" },
  { icon: <Trophy className="w-5 h-5" />,  action: "Win a Music Review session",        xp: "+75 XP", color: "text-yellow-300" },
  { icon: <Zap className="w-5 h-5" />,     action: "Daily login streak (per streak day)", xp: "+10 XP", color: "text-blue-400" },
  { icon: <Users className="w-5 h-5" />,   action: "Refer a new user",                  xp: "+100 XP", color: "text-green-400" },
];

const FAN_XP_ACTIONS = [
  { icon: <Heart className="w-5 h-5" />,         action: "Vote in Music Wars",             xp: "+5 XP",  color: "text-pink-400" },
  { icon: <Flame className="w-5 h-5" />,         action: "Cast a 🔥 Fire vote in Music Review", xp: "+2 XP", color: "text-orange-400" },
  { icon: <MessageSquare className="w-5 h-5" />, action: "Post in the Forum",              xp: "+15 XP", color: "text-blue-400" },
  { icon: <MessageSquare className="w-5 h-5" />, action: "Comment on a forum post",        xp: "+5 XP",  color: "text-blue-300" },
  { icon: <TrendingUp className="w-5 h-5" />,    action: "Watch a live stream session",    xp: "+5 XP",  color: "text-purple-400" },
  { icon: <Zap className="w-5 h-5" />,           action: "Daily login streak (per streak day)", xp: "+10 XP", color: "text-yellow-400" },
];

function TierCard({
  tier,
  isLast,
}: {
  tier: typeof ARTIST_TIERS[number];
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      {/* Vertical line connector */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-white/10" />
      )}
      {/* Icon circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 z-10 bg-[#080808]"
        style={{ borderColor: tier.color }}
      >
        {tier.icon}
      </div>
      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="font-['Anton'] text-lg uppercase" style={{ color: tier.color }}>
            {tier.label}
          </span>
          <span className="text-xs text-white/30 border border-white/10 px-2 py-0.5 rounded">
            {tier.minXP.toLocaleString()} XP
          </span>
        </div>
        <ul className="space-y-1">
          {tier.perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm text-white/60">
              <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
              {perk}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function XPActionRow({
  icon, action, xp, color,
}: {
  icon: React.ReactNode; action: string; xp: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className={`flex-shrink-0 ${color}`}>{icon}</div>
      <span className="flex-1 text-sm text-white/70">{action}</span>
      <span className={`font-['Anton'] text-base ${color} whitespace-nowrap`}>{xp}</span>
    </div>
  );
}

export default function HowItWorks() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="pt-28 pb-16 border-b border-white/10">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-red-500" />
            <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">
              XP &amp; Tiers
            </span>
          </div>
          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase leading-none mb-4">
            HOW IT<br />
            <span className="text-red-600">WORKS</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl leading-relaxed">
            Murder Mitten Media runs on two separate XP tracks — one for <strong className="text-white">Artists</strong> and one for <strong className="text-white">Fans</strong>. Every action you take on the platform earns you XP, unlocks tiers, and opens up rewards. Here's the full breakdown.
          </p>
          {!isAuthenticated && (
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              <Zap className="w-4 h-4" />
              Sign In to Start Earning
            </a>
          )}
        </div>
      </section>

      <div className="container max-w-4xl mx-auto px-4 py-16 space-y-20">

        {/* ── TWO TRACKS ───────────────────────────────────────── */}
        <section>
          <h2 className="font-['Anton'] text-3xl uppercase mb-2">Two XP Tracks</h2>
          <p className="text-white/50 text-sm mb-8">Your account type determines which XP track you're on. Both tracks run simultaneously — you can earn on both.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Artist track */}
            <div className="border border-red-600/30 bg-red-900/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Mic2 className="w-6 h-6 text-red-500" />
                <h3 className="font-['Anton'] text-xl uppercase text-red-400">Artist XP</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                Earned by <strong className="text-white">uploading songs, winning battles, getting Fire votes, and radio plays</strong>. Unlocks artist-specific tiers from Bronze to Hall of Fame. Shown on your profile and the leaderboard.
              </p>
            </div>
            {/* Fan track */}
            <div className="border border-blue-600/30 bg-blue-900/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Heart className="w-6 h-6 text-blue-400" />
                <h3 className="font-['Anton'] text-xl uppercase text-blue-400">Fan XP</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                Earned by <strong className="text-white">voting, commenting, watching live streams, and engaging</strong> with content. Unlocks fan tiers from Supporter to Verified Tastemaker. Shown on the Fan Leaderboard.
              </p>
            </div>
          </div>
        </section>

        {/* ── HOW TO EARN — ARTISTS ────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Mic2 className="w-5 h-5 text-red-500" />
            <h2 className="font-['Anton'] text-3xl uppercase">How Artists Earn XP</h2>
          </div>
          <p className="text-white/50 text-sm mb-6">Every time you put in work on the platform, you get XP. No limits — stack it up.</p>
          <div className="border border-white/10 bg-white/[0.02] px-5 divide-y divide-white/5">
            {ARTIST_XP_ACTIONS.map((a) => (
              <XPActionRow key={a.action} {...a} />
            ))}
          </div>
        </section>

        {/* ── HOW TO EARN — FANS ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-5 h-5 text-blue-400" />
            <h2 className="font-['Anton'] text-3xl uppercase">How Fans Earn XP</h2>
          </div>
          <p className="text-white/50 text-sm mb-6">You don't have to be an artist to level up. Fans who engage consistently climb the ranks too.</p>
          <div className="border border-white/10 bg-white/[0.02] px-5 divide-y divide-white/5">
            {FAN_XP_ACTIONS.map((a) => (
              <XPActionRow key={a.action} {...a} />
            ))}
          </div>
        </section>

        {/* ── ARTIST TIERS ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="font-['Anton'] text-3xl uppercase">Artist Tiers</h2>
          </div>
          <p className="text-white/50 text-sm mb-8">Six tiers. Each one unlocks new recognition and perks. Your level is always visible on your profile.</p>
          <div className="pl-2">
            {ARTIST_TIERS.map((tier, i) => (
              <TierCard key={tier.level} tier={tier} isLast={i === ARTIST_TIERS.length - 1} />
            ))}
          </div>
        </section>

        {/* ── FAN TIERS ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-blue-400" />
            <h2 className="font-['Anton'] text-3xl uppercase">Fan Tiers</h2>
          </div>
          <p className="text-white/50 text-sm mb-8">Five fan tiers. Engage with the platform consistently and you'll climb to the top of the fan leaderboard.</p>
          <div className="pl-2">
            {FAN_TIERS.map((tier, i) => (
              <TierCard key={tier.level} tier={tier} isLast={i === FAN_TIERS.length - 1} />
            ))}
          </div>
        </section>

        {/* ── STREAK BONUS ─────────────────────────────────────── */}
        <section>
          <div className="border border-orange-500/30 bg-orange-900/10 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Flame className="w-6 h-6 text-orange-400" />
              <h3 className="font-['Anton'] text-2xl uppercase text-orange-400">Daily Streak Bonus</h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Log in every day to build your streak. Each consecutive day adds <strong className="text-white">+10 XP × your streak count</strong>. Miss a day and your streak resets to 1.
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[1, 2, 3, 5, 7, 10].map((day) => (
                <div key={day} className="text-center border border-white/10 bg-white/[0.03] py-3 px-2">
                  <div className="text-orange-400 font-['Anton'] text-xl">Day {day}</div>
                  <div className="text-white/50 text-xs mt-1">+{day * 10} XP</div>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-3">Streak XP scales with your streak count — the longer you keep it, the more you earn per day.</p>
          </div>
        </section>

        {/* ── WHERE TO TRACK ───────────────────────────────────── */}
        <section>
          <h2 className="font-['Anton'] text-3xl uppercase mb-6">Where to Track Your Progress</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/profile">
              <div className="border border-white/10 bg-white/[0.02] p-5 hover:border-red-600/40 hover:bg-white/[0.05] transition-all cursor-pointer group">
                <Shield className="w-6 h-6 text-red-500 mb-3" />
                <h4 className="font-semibold text-white mb-1 group-hover:text-red-400 transition-colors">Your Profile</h4>
                <p className="text-white/40 text-xs leading-relaxed">View your XP bar, current tier, badges, and full reward history.</p>
              </div>
            </Link>
            <Link href="/leaderboard">
              <div className="border border-white/10 bg-white/[0.02] p-5 hover:border-red-600/40 hover:bg-white/[0.05] transition-all cursor-pointer group">
                <TrendingUp className="w-6 h-6 text-yellow-400 mb-3" />
                <h4 className="font-semibold text-white mb-1 group-hover:text-yellow-400 transition-colors">Leaderboard</h4>
                <p className="text-white/40 text-xs leading-relaxed">See where you rank against all artists and fans on the platform.</p>
              </div>
            </Link>
            <Link href="/wheel">
              <div className="border border-white/10 bg-white/[0.02] p-5 hover:border-red-600/40 hover:bg-white/[0.05] transition-all cursor-pointer group">
                <Zap className="w-6 h-6 text-red-400 mb-3" />
                <h4 className="font-semibold text-white mb-1 group-hover:text-red-400 transition-colors">Daily Wheel</h4>
                <p className="text-white/40 text-xs leading-relaxed">Spin every day for a chance to win free promos, discounts, and more.</p>
              </div>
            </Link>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        {!isAuthenticated && (
          <section className="text-center py-8 border-t border-white/10">
            <h2 className="font-['Anton'] text-4xl uppercase mb-4">
              Ready to <span className="text-red-600">Stack XP?</span>
            </h2>
            <p className="text-white/50 mb-6">Create an account and start earning today.</p>
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
            >
              <Zap className="w-4 h-4" />
              Get Started Free
            </a>
          </section>
        )}

      </div>
    </div>
  );
}
