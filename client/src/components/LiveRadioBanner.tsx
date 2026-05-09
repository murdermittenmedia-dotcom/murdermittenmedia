/**
 * LiveRadioBanner — Noticeable banner shown when Music Review or Music Wars radio is live.
 * Appears at the top of relevant pages. Clicking "Tune In" loads the live stream into the
 * FloatingPlayer and navigates to the live page.
 */
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

interface LiveRadioBannerProps {
  /** If provided, only show the banner when THIS specific stream is live */
  filter?: "review" | "wars";
  /** Optional extra className for the wrapper */
  className?: string;
}

export function LiveRadioBanner({ filter, className = "" }: LiveRadioBannerProps) {
  const { reviewIsLive, reviewStreamUrl, warsIsLive, warsStreamUrl } = useLiveStatus();
  const { play } = useAudioPlayer();

  // Determine which stream to show
  const showReview = !filter || filter === "review";
  const showWars = !filter || filter === "wars";

  const reviewActive = showReview && reviewIsLive;
  const warsActive = showWars && warsIsLive;

  if (!reviewActive && !warsActive) return null;

  // Prefer Music Review if both are somehow live at the same time
  const isReview = reviewActive;
  const label = isReview ? "Music Reviews" : "Music Wars";
  const href = isReview ? "/review" : "/music-wars";
  const streamUrl = isReview ? reviewStreamUrl : warsStreamUrl;

  const handleTuneIn = () => {
    if (streamUrl) {
      play({
        url: streamUrl,
        title: `${label} — Live Radio`,
        artist: "Murder Mitten Media",
        artworkUrl: LOGO,
        isStream: true,
        sourcePage: isReview ? "Music Review" : "Music Wars",
        sourceUrl: href,
      });
    }
    window.location.href = href;
  };

  return (
    <div
      className={`w-full bg-gradient-to-r from-red-900/80 via-red-800/70 to-red-900/80 border-b border-red-600/40 backdrop-blur-sm ${className}`}
    >
      <div className="container flex items-center justify-between gap-4 py-2.5">
        {/* Left: live indicator + label */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 block leading-none mb-0.5">
              Live Now
            </span>
            <span className="text-sm font-semibold text-white truncate block">
              {label} is on air
            </span>
          </div>
        </div>

        {/* Right: Tune In button */}
        <button
          onClick={handleTuneIn}
          className="flex-shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-sm transition-all duration-200 hover:shadow-[0_0_16px_rgba(239,68,68,0.5)] active:scale-95"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Tune In
        </button>
      </div>
    </div>
  );
}
